const crypto = require('crypto');
const EventEmitter = require('events');
const { pool } = require('./db');

const HOUSE_EDGE = parseFloat(process.env.HOUSE_EDGE || '0.01');
const BETTING_WINDOW_MS = parseInt(process.env.BETTING_WINDOW_MS || '5000', 10);
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '100', 10);
const GROWTH_RATE = parseFloat(process.env.GROWTH_RATE || '0.00006');

/**
 * Provably-fair crash point.
 *
 * The server commits to `serverSeed` before betting opens by publishing only
 * its SHA-256 hash. After the round crashes, the raw seed is revealed so
 * anyone can recompute this function and confirm the crash point wasn't
 * chosen after seeing what players bet.
 *
 * This is the standard "bustabit-style" construction used across the
 * (legitimate, licensed) crash-game industry — an HMAC of the seed pair is
 * treated as a uniform random draw, and the house edge is applied by making
 * a fixed fraction of rounds instant-crash at 1.00x.
 */
function computeCrashPoint(serverSeed, clientSeed, nonce, houseEdge = HOUSE_EDGE) {
  const hmac = crypto
    .createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');

  // Use the first 52 bits (13 hex chars) as the random draw, matching the
  // precision of a JS double.
  const int52 = parseInt(hmac.slice(0, 13), 16);
  const E = Math.pow(2, 52);

  // Reserve `houseEdge` fraction of outcomes as an instant bust.
  if (int52 % Math.round(1 / houseEdge) === 0) {
    return 1.0;
  }

  const crash = Math.floor((100 * E - int52) / (E - int52)) / 100;
  return Math.max(1.0, crash);
}

function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function multiplierAtTime(elapsedMs) {
  // Smooth exponential climb: 1.00x at t=0, accelerating upward.
  const m = Math.exp(GROWTH_RATE * elapsedMs);
  return Math.max(1.0, Math.round(m * 100) / 100);
}

class CrashRound extends EventEmitter {
  constructor() {
    super();
    this.status = 'idle'; // idle -> betting -> running -> crashed
    this.roundId = null;
    this.crashPoint = null;
    this.serverSeed = null;
    this.serverSeedHash = null;
    this.clientSeed = null;
    this.nonce = null;
    this.startedAt = null;
    this._tickTimer = null;
    this._bettingTimer = null;
  }

  currentMultiplier() {
    if (this.status !== 'running' || !this.startedAt) return 1.0;
    const elapsed = Date.now() - this.startedAt;
    return multiplierAtTime(elapsed);
  }

  async startBettingPhase() {
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = hashSeed(this.serverSeed);
    this.clientSeed = crypto.randomBytes(8).toString('hex');
    this.nonce = Date.now();
    this.crashPoint = computeCrashPoint(this.serverSeed, this.clientSeed, this.nonce);
    this.status = 'betting';

    const { rows } = await pool.query(
      `INSERT INTO rounds (server_seed, server_seed_hash, client_seed, nonce, crash_point, status, betting_opened_at)
       VALUES ($1, $2, $3, $4, $5, 'betting', now())
       RETURNING id`,
      [this.serverSeed, this.serverSeedHash, this.clientSeed, this.nonce, this.crashPoint]
    );
    this.roundId = rows[0].id;

    this.emit('betting_open', {
      roundId: this.roundId,
      serverSeedHash: this.serverSeedHash, // seed itself withheld until crash
      clientSeed: this.clientSeed,
      nonce: this.nonce,
      bettingWindowMs: BETTING_WINDOW_MS,
    });

    this._bettingTimer = setTimeout(() => this.startRunningPhase(), BETTING_WINDOW_MS);
  }

  async startRunningPhase() {
    this.status = 'running';
    this.startedAt = Date.now();
    await pool.query(`UPDATE rounds SET status = 'running', started_at = now() WHERE id = $1`, [
      this.roundId,
    ]);
    this.emit('round_started', { roundId: this.roundId, startedAt: this.startedAt });

    this._tickTimer = setInterval(() => {
      const m = this.currentMultiplier();
      if (m >= this.crashPoint) {
        this.crash();
      } else {
        this.emit('tick', { roundId: this.roundId, multiplier: m });
      }
    }, TICK_INTERVAL_MS);
  }

  async crash() {
    clearInterval(this._tickTimer);
    this.status = 'crashed';
    await pool.query(
      `UPDATE rounds SET status = 'crashed', crashed_at = now() WHERE id = $1`,
      [this.roundId]
    );
    this.emit('crashed', {
      roundId: this.roundId,
      crashPoint: this.crashPoint,
      serverSeed: this.serverSeed, // reveal for verification
      serverSeedHash: this.serverSeedHash,
      clientSeed: this.clientSeed,
      nonce: this.nonce,
    });
  }
}

module.exports = { CrashRound, computeCrashPoint, hashSeed, multiplierAtTime };
