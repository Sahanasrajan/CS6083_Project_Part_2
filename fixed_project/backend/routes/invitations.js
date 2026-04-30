const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/invitations/pending - get all pending invitations for current user
router.get('/pending', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  try {
    const wsInvites = await pool.query(
      `SELECT wi.wiID, wi.wID, wi.status, wi.invited_time,
              w.name AS workspace_name,
              m.username AS invited_by
       FROM WorkspaceInvitation wi
       JOIN Workspace w ON wi.wID = w.wID
       JOIN Member m ON wi.by_mID = m.mID
       WHERE wi.invited_mID = $1 AND wi.status = 'pending'
       ORDER BY wi.invited_time DESC`,
      [mID]
    );

    const chInvites = await pool.query(
      `SELECT ci.ciID, ci.cID, ci.status, ci.invited_time,
              c.name AS channel_name, c.type AS channel_type,
              w.name AS workspace_name, w.wID,
              m.username AS invited_by
       FROM ChannelInvitation ci
       JOIN Channel c ON ci.cID = c.cID
       JOIN Workspace w ON c.wID = w.wID
       JOIN Member m ON ci.by_mID = m.mID
       WHERE ci.invited_mID = $1 AND ci.status = 'pending'
       ORDER BY ci.invited_time DESC`,
      [mID]
    );

    res.json({ workspace: wsInvites.rows, channel: chInvites.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/invitations/workspace - invite user to workspace
router.post('/workspace', requireAuth, [
  body('wID').isInt(),
  body('invitedEmail').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const byMID = req.session.user.mID;
  const { wID, invitedEmail } = req.body;

  try {
    // Inviter must be workspace admin
    const adminCheck = await pool.query(
      'SELECT is_admin FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [wID, byMID]
    );
    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Must be a workspace admin to invite' });
    }

    const invitee = await pool.query('SELECT mID FROM Member WHERE email = $1', [invitedEmail]);
    if (invitee.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const invitedMID = invitee.rows[0].mid;

    // Check already a member
    const alreadyMember = await pool.query(
      'SELECT 1 FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [wID, invitedMID]
    );
    if (alreadyMember.rows.length > 0) return res.status(409).json({ error: 'User is already a member' });

    // Check for pending invite
    const existing = await pool.query(
      `SELECT 1 FROM WorkspaceInvitation WHERE wID = $1 AND invited_mID = $2 AND status = 'pending'`,
      [wID, invitedMID]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Invitation already pending' });

    await pool.query(
      'INSERT INTO WorkspaceInvitation (wID, invited_mID, by_mID) VALUES ($1, $2, $3)',
      [wID, invitedMID, byMID]
    );
    res.status(201).json({ message: 'Invitation sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/invitations/channel - invite user to channel
router.post('/channel', requireAuth, [
  body('cID').isInt(),
  body('invitedEmail').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const byMID = req.session.user.mID;
  const { cID, invitedEmail } = req.body;

  try {
    // Inviter must be channel member
    const memberCheck = await pool.query(
      'SELECT 1 FROM ChannelMember WHERE cID = $1 AND mID = $2',
      [cID, byMID]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Must be a channel member to invite' });

    const invitee = await pool.query('SELECT mID FROM Member WHERE email = $1', [invitedEmail]);
    if (invitee.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const invitedMID = invitee.rows[0].mid;

    const alreadyMember = await pool.query(
      'SELECT 1 FROM ChannelMember WHERE cID = $1 AND mID = $2',
      [cID, invitedMID]
    );
    if (alreadyMember.rows.length > 0) return res.status(409).json({ error: 'User is already a member' });

    await pool.query(
      'INSERT INTO ChannelInvitation (cID, invited_mID, by_mID) VALUES ($1, $2, $3)',
      [cID, invitedMID, byMID]
    );
    res.status(201).json({ message: 'Invitation sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/invitations/workspace/:wiID/respond
router.post('/workspace/:wiID/respond', requireAuth, [
  body('action').isIn(['accepted', 'rejected'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const mID = req.session.user.mID;
  const { wiID } = req.params;
  const { action } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (action === 'accepted') {
      await client.query('SELECT accept_workspace_invitation($1, $2)', [wiID, mID]);
    } else {
      const result = await client.query(
        `UPDATE WorkspaceInvitation SET status = 'rejected'
         WHERE wiID = $1 AND invited_mID = $2 AND status = 'pending'`,
        [wiID, mID]
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invitation not found' });
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Invitation ${action}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/invitations/channel/:ciID/respond
router.post('/channel/:ciID/respond', requireAuth, [
  body('action').isIn(['accepted', 'rejected'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const mID = req.session.user.mID;
  const { ciID } = req.params;
  const { action } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (action === 'accepted') {
      await client.query('SELECT accept_channel_invitation($1, $2)', [ciID, mID]);
    } else {
      const result = await client.query(
        `UPDATE ChannelInvitation SET status = 'rejected'
         WHERE ciID = $1 AND invited_mID = $2 AND status = 'pending'`,
        [ciID, mID]
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invitation not found' });
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Invitation ${action}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
