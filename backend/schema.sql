-- Crash game demo schema.
-- IMPORTANT: `balance` and all coin amounts here are VIRTUAL, demo-only units.
-- There is no deposit/withdrawal of real funds anywhere in this schema.

CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL PRIMARY KEY,
    telegram_id       BIGINT UNIQUE NOT NULL,
    username          TEXT,
    first_name        TEXT,
    balance           BIGINT NOT NULL DEFAULT 0,     -- virtual coins, integer cents (1 coin = 100)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per round. The server seed is committed (hashed) before the round
-- opens for betting, and only revealed after it crashes, so a player can
-- verify after the fact that the result wasn't chosen after seeing their bet.
CREATE TABLE IF NOT EXISTS rounds (
    id                BIGSERIAL PRIMARY KEY,
    server_seed       TEXT NOT NULL,
    server_seed_hash  TEXT NOT NULL,
    client_seed       TEXT NOT NULL,          -- public, rotates each round, published in advance
    nonce             BIGINT NOT NULL,
    crash_point       NUMERIC(10,2) NOT NULL, -- e.g. 2.35 means it crashed at 2.35x
    status            TEXT NOT NULL DEFAULT 'pending', -- pending -> betting -> running -> crashed
    betting_opened_at TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    crashed_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bets (
    id                  BIGSERIAL PRIMARY KEY,
    round_id            BIGINT NOT NULL REFERENCES rounds(id),
    user_id             BIGINT NOT NULL REFERENCES users(id),
    amount              BIGINT NOT NULL,           -- virtual coins wagered
    cashout_multiplier  NUMERIC(10,2),              -- null until cashed out
    payout              BIGINT,                     -- null until resolved
    status              TEXT NOT NULL DEFAULT 'active', -- active -> cashed_out | busted
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ,
    UNIQUE (round_id, user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id),
    type           TEXT NOT NULL,   -- 'bet' | 'payout' | 'bonus' | 'admin_adjust'
    amount         BIGINT NOT NULL, -- signed: negative for debits, positive for credits
    balance_after  BIGINT NOT NULL,
    round_id       BIGINT REFERENCES rounds(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
