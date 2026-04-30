const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/workspaces - get all workspaces the user is a member of
router.get('/', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  try {
    const result = await pool.query(
      `SELECT w.wID, w.name, w.description, w.created_time,
              wm.is_admin,
              m.username AS creator_username
       FROM Workspace w
       JOIN WorkspaceMember wm ON w.wID = wm.wID
       JOIN Member m ON w.creator_mID = m.mID
       WHERE wm.mID = $1
       ORDER BY w.name`,
      [mID]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workspaces - create a new workspace
router.post('/', requireAuth, [
  body('name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('description').optional().trim().isLength({ max: 500 }).escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const mID = req.session.user.mID;
  const { name, description } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const wResult = await client.query(
      'INSERT INTO Workspace (name, description, creator_mID) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, mID]
    );
    const workspace = wResult.rows[0];

    // Auto-add creator as admin member
    await client.query(
      'INSERT INTO WorkspaceMember (wID, mID, is_admin) VALUES ($1, $2, TRUE)',
      [workspace.wid, mID]
    );

    await client.query('COMMIT');
    res.status(201).json(workspace);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/workspaces/:wID - get workspace details
router.get('/:wID', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  const { wID } = req.params;

  try {
    // Verify membership
    const memberCheck = await pool.query(
      'SELECT is_admin FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [wID, mID]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const workspace = await pool.query(
      `SELECT w.*, m.username AS creator_username, wm.is_admin AS current_user_is_admin
       FROM Workspace w
       JOIN Member m ON w.creator_mID = m.mID
       JOIN WorkspaceMember wm ON w.wID = wm.wID AND wm.mID = $2
       WHERE w.wID = $1`,
      [wID, mID]
    );

    const members = await pool.query(
      `SELECT m.mID, m.username, m.nickname, m.email, wm.is_admin, wm.joined_at
       FROM WorkspaceMember wm
       JOIN Member m ON wm.mID = m.mID
       WHERE wm.wID = $1
       ORDER BY m.username`,
      [wID]
    );

    res.json({ workspace: workspace.rows[0], members: members.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workspaces/:wID/members - list members
router.get('/:wID/members', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  const { wID } = req.params;

  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM WorkspaceMember WHERE wID = $1 AND mID = $2',
      [wID, mID]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Access denied' });

    const result = await pool.query(
      `SELECT m.mID, m.username, m.nickname, m.email, wm.is_admin
       FROM WorkspaceMember wm JOIN Member m ON wm.mID = m.mID
       WHERE wm.wID = $1 ORDER BY m.username`,
      [wID]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
