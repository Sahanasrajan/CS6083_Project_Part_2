const express = require('express');
const { query, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/search?q=keyword&wID=1
// Search messages the user has access to, optionally filtered by workspace
router.get('/', requireAuth, [
  query('q').trim().isLength({ min: 1, max: 200 }).escape(),
  query('wID').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const mID = req.session.user.mID;
  const { q, wID } = req.query;

  try {
    let queryText = `
      SELECT msg.msgID, msg.msg, msg.posted_time,
             m.username, m.nickname,
             c.cID, c.name AS channel_name, c.type AS channel_type,
             w.wID, w.name AS workspace_name
      FROM Message msg
      JOIN Member m ON msg.mID = m.mID
      JOIN Channel c ON msg.cID = c.cID
      JOIN Workspace w ON c.wID = w.wID
      JOIN ChannelMember cm ON c.cID = cm.cID AND cm.mID = $1
      WHERE msg.msg ILIKE $2
    `;
    const params = [mID, `%${q}%`];

    if (wID) {
      queryText += ` AND w.wID = $3`;
      params.push(wID);
    }

    queryText += ` ORDER BY msg.posted_time DESC LIMIT 100`;

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
