require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { pool, initSchema } = require('./db');
const { CrashRound } = require('./gameEngine');
const { verifyTelegramInitData } = require('./telegramAuth');
const userRoutes = require('./routes/user');

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const POST_ROUND_DELAY_MS = 3000; // pause between crash and next round's betting phase

async function main() {
  await initSchema();

  const app = express();
  app.use(cors({ origin: FRONTEND_ORIGIN }));
  app.use(express.json());
  app.use('/api', userRoutes);
  app.get('/health', (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: FRONTEND_ORIGIN } });

  let round = new CrashRound();
  // userId -> socket.id, so we know who to trust when they cash out.
  const activeUsersBySocket = new Map();

  function broadcastState() {
    io.emit('state', {
      status: round.status,
      roundId: round.roundId,
      multiplier: round.currentMultiplier(),
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
    });
  }

  function wireRoundEvents(r) {
    r.on('betting_open', (payload) => io.emit('betting_open', payload));
    r.on('round_started', (payload) => io.emit('round_started', payload));
    r.on('tick', (payload) => io.emit('tick', payload));
    r.on('crashed', async (payload) => {
      io.emit('crashed', payload);
      await settleRound(payload.roundId, payload.crashPoint);
      setTimeout(startNextRound, POST_ROUND_DELAY_MS);
    });
  }

  async function settleRound(roundId, crashPoint) {
    // Any bet still 'active' at crash time busts.
    const { rows: activeBets } = await pool.query(
      `SELECT id, user_id, amount FROM bets WHERE round_id = $1 AND status = 'active'`,
      [roundId]
    );
    for (const bet of activeBets) {
      await pool.query(
        `UPDATE bets SET status = 'busted', payout = 0, resolved_at = now() WHERE id = $1`,
        [bet.id]
      );
      // No balance change needed here: the wager was already debited when the bet was placed.
    }
  }

  async function startNextRound() {
    round = new CrashRound();
    wireRoundEvents(round);
    await round.startBettingPhase();
    broadcastState();
  }

  io.on('connection', (socket) => {
    broadcastState();

    socket.on('identify', async ({ initData }, ack) => {
      try {
        const tgUser = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
        const { rows } = await pool.query('SELECT id, balance FROM users WHERE telegram_id = $1', [
          tgUser.id,
        ]);
        if (!rows[0]) throw new Error('user not found, call /api/auth first');
        activeUsersBySocket.set(socket.id, rows[0].id);
        ack && ack({ ok: true, userId: rows[0].id, balance: rows[0].balance });
      } catch (err) {
        ack && ack({ ok: false, error: err.message });
      }
    });

    socket.on('place_bet', async ({ amount }, ack) => {
      try {
        const userId = activeUsersBySocket.get(socket.id);
        if (!userId) throw new Error('not identified');
        if (round.status !== 'betting') throw new Error('betting is closed for this round');
        if (!Number.isInteger(amount) || amount <= 0) throw new Error('invalid amount');

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows: userRows } = await client.query(
            'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
          );
          const balance = userRows[0].balance;
          if (balance < amount) throw new Error('insufficient balance');

          const newBalance = balance - amount;
          await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
          await client.query(
            `INSERT INTO bets (round_id, user_id, amount, status) VALUES ($1, $2, $3, 'active')`,
            [round.roundId, userId, amount]
          );
          await client.query(
            `INSERT INTO transactions (user_id, type, amount, balance_after, round_id)
             VALUES ($1, 'bet', $2, $3, $4)`,
            [userId, -amount, newBalance, round.roundId]
          );
          await client.query('COMMIT');
          ack && ack({ ok: true, balance: newBalance });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        ack && ack({ ok: false, error: err.message });
      }
    });

    socket.on('cash_out', async (_payload, ack) => {
      try {
        const userId = activeUsersBySocket.get(socket.id);
        if (!userId) throw new Error('not identified');
        if (round.status !== 'running') throw new Error('round is not running');

        const multiplier = round.currentMultiplier();

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows: betRows } = await client.query(
            `SELECT id, amount FROM bets WHERE round_id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
            [round.roundId, userId]
          );
          if (!betRows[0]) throw new Error('no active bet this round');

          const payout = Math.floor(betRows[0].amount * multiplier);
          await client.query(
            `UPDATE bets SET status = 'cashed_out', cashout_multiplier = $1, payout = $2, resolved_at = now() WHERE id = $3`,
            [multiplier, payout, betRows[0].id]
          );
          const { rows: userRows } = await client.query(
            'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
          );
          const newBalance = userRows[0].balance + payout;
          await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
          await client.query(
            `INSERT INTO transactions (user_id, type, amount, balance_after, round_id)
             VALUES ($1, 'payout', $2, $3, $4)`,
            [userId, payout, newBalance, round.roundId]
          );
          await client.query('COMMIT');
          ack && ack({ ok: true, multiplier, payout, balance: newBalance });
          io.emit('player_cashed_out', { userId, multiplier, payout });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        ack && ack({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      activeUsersBySocket.delete(socket.id);
    });
  });

  server.listen(PORT, () => {
    console.log(`[server] listening on :${PORT}`);
    startNextRound();
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
