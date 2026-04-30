const express = require('express');
const { body, query, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/:cID - get messages for a channel
router.get('/:cID', requireAuth, async (req, res) => {
  const mID = req.session.user.mID;
  const { cID } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Verify access
    const channel = await pool.query(
      `SELECT c.type, CASE WHEN cm.mID IS NOT NULL THEN TRUE ELSE FALSE END AS is_member
       FROM Channel c
       LEFT JOIN ChannelMember cm ON c.cID = cm.cID AND cm.mID = $2
       WHERE c.cID = $1`,
      [cID, mID]
    );

    if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
    if (channel.rows[0].type !== 'public' && !channel.rows[0].is_member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT msg.msgID, msg.msg, msg.posted_time,
              m.mID, m.username, m.nickname
       FROM Message msg
       JOIN Member m ON msg.mID = m.mID
       WHERE msg.cID = $1
       ORDER BY msg.posted_time ASC
       LIMIT $2 OFFSET $3`,
      [cID, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/:cID - post a message
router.post('/:cID', requireAuth, [
  body('msg').trim().isLength({ min: 1, max: 4000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const mID = req.session.user.mID;
  const { cID } = req.params;
  const { msg } = req.body;

  try {
    // Must be channel member
    const memberCheck = await pool.query(
      'SELECT 1 FROM ChannelMember WHERE cID = $1 AND mID = $2',
      [cID, mID]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Must be a channel member to post' });

    const result = await pool.query(
      `INSERT INTO Message (cID, mID, msg) VALUES ($1, $2, $3)
       RETURNING msgID, msg, posted_time`,
      [cID, mID, msg]
    );

    const message = result.rows[0];
    res.status(201).json({
      ...message,
      username: req.session.user.username,
      nickname: req.session.user.nickname,
      mid: mID
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
