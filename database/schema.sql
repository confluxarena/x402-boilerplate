-- x402 Boilerplate — PostgreSQL Schema
-- Conflux eSpace x402 Protocol Implementation
--
-- Usage:
--   psql -U x402 -d x402 -f schema.sql

-- Payment logs for x402 API requests
CREATE TABLE IF NOT EXISTS x402_api_payments (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL DEFAULT '/api/x402/ai',
    payer_address VARCHAR(42) NOT NULL,
    asset_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    question TEXT,
    answer_length INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_x402_payments_payer ON x402_api_payments (payer_address);
CREATE INDEX IF NOT EXISTS idx_x402_payments_tx ON x402_api_payments (tx_hash);
CREATE INDEX IF NOT EXISTS idx_x402_payments_created ON x402_api_payments (created_at);
