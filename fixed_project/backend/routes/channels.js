const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/channels/workspace/:wID - get channels accessible to user in a workspace
router.get('/workspace/:wID', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  const { wID } = req.params;

  try {
    // Must be workspace member
    const memberCheck = await pool.query(
      'SELECT 1 FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [wID, mID]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Access denied' });

    // Return public channels + channels the user is a member of
    const result = await pool.query(
      `SELECT c.cID, c.name, c.type, c.created_time, m.username AS creator_username,
              CASE WHEN cm.mID IS NOT NULL THEN TRUE ELSE FALSE END AS is_member
       FROM Channel c
       JOIN Member m ON c.creator_mID = m.mID
       LEFT JOIN ChannelMember cm ON c.cID = cm.cID AND cm.mID = $2
       WHERE c.wID = $1
         AND (c.type = 'public' OR cm.mID IS NOT NULL)
       ORDER BY c.type, c.name`,
      [wID, mID]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/channels - create a channel
router.post('/', requireAuth, [
  body('wID').isInt(),
  body('name').trim().isLength({ min: 1, max: 150 }).escape(),
  body('type').isIn(['public', 'private', 'direct'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const mID = req.session.user.mID;
  const { wID, name, type } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Must be workspace member to create channel
    const memberCheck = await client.query(
      'SELECT 1 FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [wID, mID]
    );
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Must be a workspace member to create channels' });
    }

    const cResult = await client.query(
      'INSERT INTO Channel (wID, name, type, creator_mID) VALUES ($1, $2, $3, $4) RETURNING *',
      [wID, name, type, mID]
    );
    const channel = cResult.rows[0];

    // Auto-add creator as channel member
    await client.query(
      'INSERT INTO ChannelMember (cID, mID) VALUES ($1, $2)',
      [channel.cid, mID]
    );

    await client.query('COMMIT');
    res.status(201).json(channel);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/channels/:cID - get channel details + members
router.get('/:cID', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  const { cID } = req.params;

  try {
    // Check access
    const channel = await pool.query(
      `SELECT c.*, m.username AS creator_username,
              CASE WHEN cm.mID IS NOT NULL THEN TRUE ELSE FALSE END AS is_member
       FROM Channel c
       JOIN Member m ON c.creator_mID = m.mID
       LEFT JOIN ChannelMember cm ON c.cID = cm.cID AND cm.mID = $2
       WHERE c.cID = $1`,
      [cID, mID]
    );

    if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

    const ch = channel.rows[0];
    if (ch.type !== 'public' && !ch.is_member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await pool.query(
      `SELECT m.mID, m.username, m.nickname FROM ChannelMember cm
       JOIN Member m ON cm.mID = m.mID WHERE cm.cID = $1 ORDER BY m.username`,
      [cID]
    );

    res.json({ channel: ch, members: members.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/channels/:cID/join - join a public channel
router.post('/:cID/join', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  const { cID } = req.params;

  try {
    const channel = await pool.query('SELECT * FROM Channel WHERE cID = $1', [cID]);
    if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });

    if (channel.rows[0].type !== 'public') {
      return res.status(403).json({ error: 'Can only join public channels directly' });
    }

    // Must be workspace member
    const wsCheck = await pool.query(
      'SELECT 1 FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [channel.rows[0].wid, mID]
    );
    if (wsCheck.rows.length === 0) return res.status(403).json({ error: 'Not a workspace member' });

    await pool.query(
      'INSERT INTO ChannelMember (cID, mID) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [cID, mID]
    );
    res.json({ message: 'Joined channel successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
