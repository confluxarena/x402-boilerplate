# x402 Boilerplate — Conflux eSpace

Production-ready implementation of the [x402 protocol](https://www.x402.org) for paid AI APIs on **Conflux eSpace** (mainnet, chain 1030).

Users pay **0.01 USDT0** per AI query via **EIP-3009 `transferWithAuthorization`** — gasless for the buyer, settled on-chain by the facilitator.

## What's Inside

| Component | Description |
|-----------|-------------|
| **PHP Backend** | x402 middleware, paid AI endpoint (`/api/x402/ai.php`), demo proxy |
| **Facilitator** | Node.js server that verifies signatures & settles payments on-chain |
| **AI Agent** | Standalone CLI script — autonomous machine-to-machine payment demo |
| **Demo Page** | Two modes: server-side demo + browser wallet payment (8 wallets) |
| **Wallet Connect** | Production-tested multi-wallet: MetaMask, Fluent, OKX, WalletConnect (500+) |

## x402 Protocol Flow

```
Client                         Seller (PHP)              Facilitator (Node.js)       Blockchain
  │                               │                           │                         │
  │── GET /api/x402/ai?q=... ──> │                           │                         │
  │<── 402 + PAYMENT-REQUIRED ── │                           │                         │
  │                               │                           │                         │
  │   [Sign EIP-712 in wallet]    │                           │                         │
  │                               │                           │                         │
  │── GET + PAYMENT-SIGNATURE ──>│                            │                         │
  │                               │── POST /verify-transfer ─>│                         │
  │                               │<── { valid: true } ───────│                         │
  │                               │── POST /settle-transfer ─>│                         │
  │                               │                           │── transferWithAuth() ──>│
  │                               │                           │<── tx receipt ──────────│
  │                               │<── { success, tx_hash } ──│                         │
  │<── 200 + AI answer ──────────│                            │                         │
```

## Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/confluxarena/x402-boilerplate.git
cd x402-boilerplate
cp .env.example .env
# Edit .env with your keys
```

### 2. Docker

```bash
docker compose up -d
# Open http://localhost
```

### 3. Manual Setup

**Requirements:** PHP 8.4+, PostgreSQL 16+, Node.js 20+

```bash
# Database
psql -U x402 -d x402 -f database/schema.sql

# Facilitator
npm install
npm run facilitator

# PHP (Apache/nginx)
# Point document root to this directory
```

### 4. AI Agent Demo (CLI)

```bash
npm install
DEMO_BUYER_KEY=0x... node agent/x402-ai-agent-demo.cjs "What is Conflux?"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ARENA_SIGNER_PRIVATE_KEY` | Yes | Relayer wallet (pays gas for settlement) |
| `X402_API_TREASURY` | Yes | Treasury address (receives USDT0 payments) |
| `X402_FACILITATOR_KEY` | Yes | Shared secret (PHP ↔ Facilitator auth) |
| `CLAUDE_API_KEY` | Yes | Anthropic API key for AI responses |
| `DEMO_BUYER_KEY` | No | Demo wallet key (for server-side demo mode) |
| `DB_PGSQL_*` | Yes | PostgreSQL connection details |

## Architecture

```
x402-boilerplate/
├── api/
│   ├── config/          # EnvLoader, Database (PostgreSQL)
│   ├── middleware/       # X402Middleware (escrow + transfer modes)
│   ├── utils/           # Response helper
│   └── x402/
│       ├── ai.php              # Paid AI endpoint (seller)
│       └── ai-demo-proxy.php   # Server-side demo proxy
├── assets/js/
│   ├── config/          # wallets.js, networks.js
│   ├── services/        # walletService, x402Service, web3Service, appkitService
│   └── components/      # walletModal
├── facilitator/
│   └── x402-facilitator.cjs    # x402 facilitator server (port 3849)
├── agent/
│   └── x402-ai-agent-demo.cjs  # Standalone CLI agent
├── database/
│   └── schema.sql              # PostgreSQL schema
├── x402-demo.html              # Demo page (server + wallet modes)
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Supported Wallets

| Wallet | Method | Notes |
|--------|--------|-------|
| MetaMask | EIP-6963 | Strict RDNS check (`io.metamask`) |
| Fluent | EIP-6963 + Hybrid | Best for Conflux, handles multi-wallet conflicts |
| OKX | Extension + WalletConnect | Auto-detects mobile, falls back to QR |
| WalletConnect | Reown AppKit CDN | 500+ wallets via QR scan |
| Halo, TokenPocket, Coinbase, Trust | Injected | Standard `window.ethereum` |

## Settlement Modes

### Direct Transfer (default)
Buyer signs EIP-3009 → facilitator calls `transferWithAuthorization()` → USDT0 goes directly to treasury.

### Escrow (optional)
Buyer signs EIP-3009 → facilitator calls `X402EscrowAdapter.settlePayment()` → atomic escrow settlement. Requires deployed `X402EscrowAdapter` contract.

## Supported Tokens

| Token | Address | Decimals | EIP-3009 |
|-------|---------|----------|----------|
| USDT0 | `0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff` | 6 | Yes |
| CNHT0 | `0xded1660192d4d82e7c0b628ba556861edbb5cada` | 6 | Yes |

## Key Standards

- **x402 V2** — HTTP 402 Payment Required protocol
- **EIP-3009** — `transferWithAuthorization` (gasless for buyer)
- **EIP-712** — Typed structured data signing
- **EIP-6963** — Multi Injected Provider Discovery
- **EIP-3085** — `wallet_addEthereumChain`

## Security

- Facilitator binds to `127.0.0.1` only — not exposed to internet
- API key authentication between PHP ↔ Facilitator
- Signature verification with signer recovery before settlement
- Balance and time window validation before execution
- Rate limiting on demo proxy (5 req/min per IP)

## License

MIT

## Credits

Built by [Conflux Arena](https://confluxarena.org) for the Conflux ecosystem.
