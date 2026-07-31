const express = require('express');
const { pool } = require('../db');
const { verifyTelegramInitData } = require('../telegramAuth');

const STARTING_BALANCE = parseInt(process.env.STARTING_BALANCE || '1000', 10);

const router = express.Router();

// POST /api/auth  { initData }
// Verifies the Telegram Mini App launch payload, upserts the user, and
// returns their current (virtual) balance.
router.post('/auth', async (req, res) => {
  try {
    const tgUser = verifyTelegramInitData(req.body.initData, process.env.TELEGRAM_BOT_TOKEN);

    const { rows } = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, balance)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id)
       DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_seen_at = now()
       RETURNING id, telegram_id, username, first_name, balance`,
      [tgUser.id, tgUser.username || null, tgUser.first_name || null, STARTING_BALANCE]
    );

    const user = rows[0];
    // Simple demo session token: sign the user id. Swap for real JWTs/sessions
    // before this ever handles anything beyond a demo.
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/users/:id/balance', async (req, res) => {
  const { rows } = await pool.query('SELECT balance FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ balance: rows[0].balance });
});

router.get('/users/:id/history', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.round_id, b.amount, b.cashout_multiplier, b.payout, b.status, b.created_at,
            r.crash_point
     FROM bets b JOIN rounds r ON r.id = b.round_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC
     LIMIT 50`,
    [req.params.id]
  );
  res.json({ history: rows });
});

module.exports = router;
