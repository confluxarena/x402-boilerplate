#!/usr/bin/env node
/**
 * x402 Facilitator Service
 *
 * Self-hosted x402 V2 facilitator for Conflux eSpace.
 * Handles EIP-3009 payment verification and settlement.
 *
 * Supports two settlement modes:
 *   - Escrow:   via X402EscrowAdapter contract (requires X402_ADAPTER_ADDRESS)
 *   - Transfer: direct EIP-3009 transferWithAuthorization (buyer → treasury)
 *
 * Usage:
 *   node x402-facilitator.cjs
 *
 * Environment variables (from .env):
 *   - ARENA_SIGNER_PRIVATE_KEY: Relayer wallet private key (required)
 *   - X402_FACILITATOR_KEY: API key for PHP backend authentication (required)
 *   - X402_ADAPTER_ADDRESS: X402EscrowAdapter contract address (optional, for escrow mode)
 *   - X402_FACILITATOR_PORT: Server port (default: 3849)
 *   - DEMO_BUYER_KEY: Private key for demo page server-side payments
 *   - API_URL: AI endpoint URL (default: http://localhost/api/x402/ai.php)
 *
 * Endpoints:
 *   GET  /x402/health           - Health check
 *   POST /x402/verify           - Verify payment (escrow mode)
 *   POST /x402/settle           - Execute payment via escrow
 *   POST /x402/verify-transfer  - Verify payment (direct transfer mode)
 *   POST /x402/settle-transfer  - Execute direct EIP-3009 transfer
 *   POST /x402/demo-ai          - Full x402 flow for web demo page
 *
 * @package x402-boilerplate
 * @version 1.0.0
 */

const http = require('http');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ============================================
// ENVIRONMENT LOADER
// ============================================

function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env');

    try {
        if (!fs.existsSync(envPath)) {
            console.log('[x402] No .env file found, using process.env only');
            return;
        }

        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            if (!line || line.startsWith('#') || !line.includes('=')) continue;

            const equalIndex = line.indexOf('=');
            const key = line.substring(0, equalIndex).trim();
            let value = line.substring(equalIndex + 1).trim();

            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            if (!process.env[key]) {
                process.env[key] = value;
            }
        }

        console.log(`[x402] Loaded ${envPath}`);
    } catch (error) {
        console.error(`[x402] Error loading ${envPath}:`, error.message);
    }
}

loadEnv();

// ============================================
// CONFIGURATION
// ============================================

const PORT = parseInt(process.env.X402_FACILITATOR_PORT || '3849', 10);
const API_KEY = process.env.X402_FACILITATOR_KEY || '';
const PRIVATE_KEY = process.env.ARENA_SIGNER_PRIVATE_KEY;

const CONFIG = {
    chainId: 1030,
    network: 'eip155:1030',
    rpc: 'https://evm.confluxrpc.com',

    // Supported assets (EIP-3009 compatible)
    assets: {
        '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff': {
            symbol: 'USDT0',
            decimals: 6,
            eip3009: true,
            eip712Name: 'USDT0',
            eip712Version: '1',
        },
        '0xded1660192d4d82e7c0b628ba556861edbb5cada': {
            symbol: 'CNHT0',
            decimals: 6,
            eip3009: true,
            eip712Name: 'CNHT0',
            eip712Version: '1',
        },
    },

    // Escrow contracts (optional — only needed for escrow mode)
    escrowCore: '0xb5DC3229c86c12ae03449c4596259b8712074B38',
    escrowAdapter: process.env.X402_ADAPTER_ADDRESS || '',
};

// X402EscrowAdapter ABI (escrow mode)
const ADAPTER_ABI = [
    'function settlePayment(address token, bytes32 orderId, address buyer, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature) external',
];

// EIP-3009 transferWithAuthorization ABI (direct transfer mode)
const EIP3009_ABI = [
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) external',
];

// ERC-20 balanceOf ABI
const ERC20_ABI = [
    'function balanceOf(address account) view returns (uint256)',
];

// EIP-712 types for TransferWithAuthorization
const TRANSFER_AUTH_TYPES = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
};

// ============================================
// BLOCKCHAIN CONNECTION
// ============================================

let provider;
let relayerWallet;
let relayerAddress;

async function initialize() {
    if (!PRIVATE_KEY) {
        console.error('[x402] ARENA_SIGNER_PRIVATE_KEY is required');
        return false;
    }

    if (!API_KEY) {
        console.error('[x402] X402_FACILITATOR_KEY is required');
        return false;
    }

    try {
        provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        relayerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
        relayerAddress = relayerWallet.address;

        const network = await provider.getNetwork();
        console.log(`[x402] Connected to chain ${network.chainId}`);
        console.log(`[x402] Relayer wallet: ${relayerAddress}`);

        if (CONFIG.escrowAdapter) {
            console.log(`[x402] Adapter contract: ${CONFIG.escrowAdapter}`);
        } else {
            console.log('[x402] Escrow adapter not configured (transfer mode only)');
        }

        return true;
    } catch (error) {
        console.error('[x402] Initialization failed:', error.message);
        return false;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1048576) reject(new Error('Body too large'));
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (error) { reject(error); }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// ============================================
// HANDLERS
// ============================================

async function handleHealth(req, res) {
    try {
        const balance = await provider.getBalance(relayerAddress);
        sendJson(res, 200, {
            status: 'ok',
            network: CONFIG.network,
            chainId: CONFIG.chainId,
            facilitator: relayerAddress,
            adapter: CONFIG.escrowAdapter || null,
            balanceCFX: ethers.formatEther(balance),
            supportedAssets: Object.entries(CONFIG.assets).map(([addr, info]) => ({
                address: addr,
                symbol: info.symbol,
                eip3009: info.eip3009,
            })),
            x402Version: 2,
        });
    } catch (error) {
        sendJson(res, 500, { status: 'error', error: error.message });
    }
}

// ── Escrow mode ──

async function handleVerify(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return sendJson(res, 401, { error: 'Invalid or missing API key' });
    }

    if (!CONFIG.escrowAdapter) {
        return sendJson(res, 400, { valid: false, reason: 'Escrow adapter not configured' });
    }

    let body;
    try { body = await parseBody(req); }
    catch { return sendJson(res, 400, { valid: false, reason: 'Invalid JSON body' }); }

    const { payload, requirements } = body;

    try {
        if (payload.x402Version !== 2) return sendJson(res, 200, { valid: false, reason: 'Unsupported x402 version' });
        if (payload.scheme !== 'exact') return sendJson(res, 200, { valid: false, reason: 'Unsupported scheme' });
        if (payload.network !== CONFIG.network) return sendJson(res, 200, { valid: false, reason: `Wrong network: ${payload.network}` });

        const assetAddr = requirements.asset.toLowerCase();
        const asset = CONFIG.assets[assetAddr];
        if (!asset || !asset.eip3009) return sendJson(res, 200, { valid: false, reason: 'Unsupported asset' });
        if (requirements.extra?.assetTransferMethod !== 'eip3009') return sendJson(res, 200, { valid: false, reason: 'Only eip3009 method supported' });

        const { from, to, value, validAfter, validBefore, nonce } = payload.payload.authorization;

        const domain = {
            name: asset.eip712Name,
            version: asset.eip712Version,
            chainId: CONFIG.chainId,
            verifyingContract: requirements.asset,
        };

        const message = { from, to, value, validAfter, validBefore, nonce };
        const recoveredSigner = ethers.verifyTypedData(domain, TRANSFER_AUTH_TYPES, message, payload.payload.signature);

        if (recoveredSigner.toLowerCase() !== from.toLowerCase()) return sendJson(res, 200, { valid: false, reason: 'Invalid signature' });
        if (to.toLowerCase() !== CONFIG.escrowAdapter.toLowerCase()) return sendJson(res, 200, { valid: false, reason: 'Wrong payment destination' });

        const token = new ethers.Contract(requirements.asset, ERC20_ABI, provider);
        const balance = await token.balanceOf(from);
        if (balance < BigInt(value)) return sendJson(res, 200, { valid: false, reason: 'Insufficient balance' });

        const now = Math.floor(Date.now() / 1000);
        if (now < Number(validAfter) || now > Number(validBefore)) return sendJson(res, 200, { valid: false, reason: 'Authorization expired or not yet valid' });
        if (BigInt(value) < BigInt(requirements.amount)) return sendJson(res, 200, { valid: false, reason: 'Insufficient amount' });

        const adapter = new ethers.Contract(CONFIG.escrowAdapter, ADAPTER_ABI, provider);
        try {
            await adapter.settlePayment.staticCall(
                requirements.asset, requirements.extra.orderId, from, value,
                validAfter, validBefore, nonce, payload.payload.signature,
                { from: relayerAddress }
            );
        } catch (simError) {
            return sendJson(res, 200, { valid: false, reason: 'Settlement simulation failed: ' + (simError.reason || simError.message) });
        }

        sendJson(res, 200, { valid: true });
    } catch (error) {
        console.error('[x402] Verify error:', error);
        sendJson(res, 200, { valid: false, reason: error.message });
    }
}

async function handleSettle(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) return sendJson(res, 401, { error: 'Invalid or missing API key' });
    if (!CONFIG.escrowAdapter) return sendJson(res, 400, { success: false, error: 'Escrow adapter not configured' });

    let body;
    try { body = await parseBody(req); }
    catch { return sendJson(res, 400, { success: false, error: 'Invalid JSON body' }); }

    const { payload, requirements } = body;

    try {
        const { from, to, value, validAfter, validBefore, nonce } = payload.payload.authorization;
        const adapter = new ethers.Contract(CONFIG.escrowAdapter, ADAPTER_ABI, relayerWallet);

        const tx = await adapter.settlePayment(
            requirements.asset, requirements.extra.orderId, from, value,
            validAfter, validBefore, nonce, payload.payload.signature,
            { gasLimit: 500_000 }
        );

        console.log(`[x402] Settlement tx sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`[x402] Settlement confirmed in block ${receipt.blockNumber}`);

        sendJson(res, 200, {
            x402Version: 2, scheme: 'exact', network: CONFIG.network,
            success: true, transaction: receipt.hash, payer: from,
        });
    } catch (error) {
        console.error('[x402] Settle error:', error);
        sendJson(res, 500, { success: false, error: error.reason || error.message });
    }
}

// ── Transfer mode (direct EIP-3009, no escrow) ──

async function handleVerifyTransfer(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) return sendJson(res, 401, { error: 'Invalid or missing API key' });

    let body;
    try { body = await parseBody(req); }
    catch { return sendJson(res, 400, { valid: false, reason: 'Invalid JSON body' }); }

    const { payload, requirements } = body;

    try {
        if (payload.x402Version !== 2) return sendJson(res, 200, { valid: false, reason: 'Unsupported x402 version' });
        if (payload.scheme !== 'exact') return sendJson(res, 200, { valid: false, reason: 'Unsupported scheme' });
        if (payload.network !== CONFIG.network) return sendJson(res, 200, { valid: false, reason: `Wrong network: ${payload.network}` });

        const assetAddr = requirements.asset.toLowerCase();
        const asset = CONFIG.assets[assetAddr];
        if (!asset || !asset.eip3009) return sendJson(res, 200, { valid: false, reason: 'Unsupported asset' });
        if (requirements.extra?.settlementMode !== 'transfer') return sendJson(res, 200, { valid: false, reason: 'Settlement mode must be transfer' });

        const { from, to, value, validAfter, validBefore, nonce } = payload.payload.authorization;

        const domain = {
            name: asset.eip712Name,
            version: asset.eip712Version,
            chainId: CONFIG.chainId,
            verifyingContract: requirements.asset,
        };

        const message = { from, to, value, validAfter, validBefore, nonce };
        const recoveredSigner = ethers.verifyTypedData(domain, TRANSFER_AUTH_TYPES, message, payload.payload.signature);

        if (recoveredSigner.toLowerCase() !== from.toLowerCase()) return sendJson(res, 200, { valid: false, reason: 'Invalid signature' });
        if (to.toLowerCase() !== requirements.payTo.toLowerCase()) return sendJson(res, 200, { valid: false, reason: 'Wrong payment destination (expected treasury)' });

        const token = new ethers.Contract(requirements.asset, ERC20_ABI, provider);
        const balance = await token.balanceOf(from);
        if (balance < BigInt(value)) return sendJson(res, 200, { valid: false, reason: 'Insufficient balance' });

        const now = Math.floor(Date.now() / 1000);
        if (now < Number(validAfter) || now > Number(validBefore)) return sendJson(res, 200, { valid: false, reason: 'Authorization expired or not yet valid' });
        if (BigInt(value) < BigInt(requirements.amount)) return sendJson(res, 200, { valid: false, reason: 'Insufficient amount' });

        sendJson(res, 200, { valid: true });
    } catch (error) {
        console.error('[x402] Verify-transfer error:', error);
        sendJson(res, 200, { valid: false, reason: error.message });
    }
}

async function handleSettleTransfer(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) return sendJson(res, 401, { error: 'Invalid or missing API key' });

    let body;
    try { body = await parseBody(req); }
    catch { return sendJson(res, 400, { success: false, error: 'Invalid JSON body' }); }

    const { payload, requirements } = body;

    try {
        const { from, to, value, validAfter, validBefore, nonce } = payload.payload.authorization;
        const token = new ethers.Contract(requirements.asset, EIP3009_ABI, relayerWallet);

        const tx = await token.transferWithAuthorization(
            from, to, value, validAfter, validBefore, nonce,
            payload.payload.signature, { gasLimit: 200_000 }
        );

        console.log(`[x402] Transfer tx sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`[x402] Transfer confirmed in block ${receipt.blockNumber}`);

        sendJson(res, 200, {
            x402Version: 2, scheme: 'exact', network: CONFIG.network,
            success: true, transaction: receipt.hash, payer: from,
        });
    } catch (error) {
        console.error('[x402] Settle-transfer error:', error);
        sendJson(res, 500, { success: false, error: error.reason || error.message });
    }
}

// ── Demo AI handler ──

async function handleDemoAi(req, res) {
    const facilitatorKey = req.headers['x-facilitator-key'];
    if (!facilitatorKey || facilitatorKey !== API_KEY) return sendJson(res, 401, { error: 'Invalid or missing API key' });

    let body;
    try { body = await parseBody(req); }
    catch { return sendJson(res, 400, { success: false, message: 'Invalid JSON body' }); }

    const question = (body.question || '').trim();
    if (!question || question.length > 500) return sendJson(res, 422, { success: false, message: 'Question required (max 500 chars)' });

    const demoKey = process.env.DEMO_BUYER_KEY;
    if (!demoKey) return sendJson(res, 500, { success: false, message: 'No demo wallet configured (set DEMO_BUYER_KEY)' });

    const demoWallet = new ethers.Wallet(demoKey, provider);
    const apiUrl = process.env.API_URL || 'http://localhost/api/x402/ai.php';

    try {
        // Step 1: GET → 402
        const url = `${apiUrl}?q=${encodeURIComponent(question)}`;
        const firstRes = await fetch(url);

        if (firstRes.status !== 402) {
            const text = await firstRes.text();
            console.error(`[x402 demo] Expected 402, got ${firstRes.status}: ${text}`);
            return sendJson(res, 502, { success: false, message: `API returned ${firstRes.status}` });
        }

        const reqHeader = firstRes.headers.get('payment-required');
        if (!reqHeader) return sendJson(res, 502, { success: false, message: 'Missing PAYMENT-REQUIRED header' });

        const requirements = JSON.parse(Buffer.from(reqHeader, 'base64').toString())[0];

        // Step 2: Check balance
        const token = new ethers.Contract(requirements.asset, ERC20_ABI, provider);
        const balance = await token.balanceOf(demoWallet.address);
        const required = BigInt(requirements.amount);

        if (balance < required) {
            return sendJson(res, 400, {
                success: false,
                message: `Insufficient USDT0 balance: ${ethers.formatUnits(balance, 6)} < ${ethers.formatUnits(required, 6)}`,
            });
        }

        // Step 3: Sign EIP-3009
        const now = Math.floor(Date.now() / 1000);
        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const assetAddr = requirements.asset.toLowerCase();
        const assetInfo = CONFIG.assets[assetAddr];

        const domain = {
            name: requirements.extra?.name || assetInfo?.eip712Name || 'USDT0',
            version: requirements.extra?.version || assetInfo?.eip712Version || '1',
            chainId: CONFIG.chainId,
            verifyingContract: requirements.asset,
        };

        const message = {
            from: demoWallet.address,
            to: requirements.payTo,
            value: requirements.amount,
            validAfter: 0,
            validBefore: now + 3600,
            nonce: nonce,
        };

        const signature = await demoWallet.signTypedData(domain, TRANSFER_AUTH_TYPES, message);

        // Step 4: Build x402 payload and retry
        const x402Payload = {
            x402Version: 2,
            scheme: 'exact',
            network: `eip155:${CONFIG.chainId}`,
            payload: {
                signature: signature,
                authorization: {
                    from: demoWallet.address,
                    to: requirements.payTo,
                    value: requirements.amount,
                    validAfter: '0',
                    validBefore: String(now + 3600),
                    nonce: nonce,
                },
            },
        };

        const paymentSig = Buffer.from(JSON.stringify(x402Payload)).toString('base64');
        const paidRes = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': paymentSig } });
        const result = await paidRes.json();

        if (paidRes.status !== 200 || !result.success) {
            console.error(`[x402 demo] Payment failed: ${paidRes.status}`, result);
            return sendJson(res, paidRes.status >= 400 ? paidRes.status : 502, result);
        }

        console.log(`[x402 demo] AI query paid: ${result.data?.payment?.tx_hash} by ${demoWallet.address}`);
        sendJson(res, 200, result);
    } catch (error) {
        console.error('[x402 demo] Error:', error);
        sendJson(res, 500, { success: false, message: error.message });
    }
}

// ============================================
// HTTP SERVER
// ============================================

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (pathname === '/x402/health' && req.method === 'GET') return handleHealth(req, res);
    if (pathname === '/x402/verify' && req.method === 'POST') return handleVerify(req, res);
    if (pathname === '/x402/settle' && req.method === 'POST') return handleSettle(req, res);
    if (pathname === '/x402/verify-transfer' && req.method === 'POST') return handleVerifyTransfer(req, res);
    if (pathname === '/x402/settle-transfer' && req.method === 'POST') return handleSettleTransfer(req, res);
    if (pathname === '/x402/demo-ai' && req.method === 'POST') return handleDemoAi(req, res);

    sendJson(res, 404, { error: 'Not found' });
});

// ============================================
// STARTUP
// ============================================

async function start() {
    console.log('[x402] x402 Facilitator Service v1.0.0');
    console.log('[x402] Conflux eSpace Mainnet (chainId: 1030)');
    console.log('');

    const initialized = await initialize();
    if (!initialized) process.exit(1);

    const balance = await provider.getBalance(relayerAddress);
    console.log(`[x402] Balance: ${ethers.formatEther(balance)} CFX`);

    if (balance < ethers.parseEther('10')) {
        console.warn('[x402] WARNING: Low balance! Recommend 500+ CFX for production');
    }

    server.listen(PORT, '127.0.0.1', () => {
        console.log('');
        console.log(`[x402] Server running on http://127.0.0.1:${PORT}`);
        console.log('[x402] Endpoints:');
        console.log(`  GET  /x402/health`);
        console.log(`  POST /x402/verify           (escrow mode)`);
        console.log(`  POST /x402/settle           (escrow mode)`);
        console.log(`  POST /x402/verify-transfer  (direct transfer)`);
        console.log(`  POST /x402/settle-transfer  (direct transfer)`);
        console.log(`  POST /x402/demo-ai          (demo page)`);
        console.log('');
        console.log('[x402] Ready to accept requests');
    });
}

process.on('SIGINT', () => { console.log('\n[x402] Shutting down...'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('unhandledRejection', (reason) => { console.error('[x402] Unhandled rejection:', reason); });

start().catch(error => { console.error('[x402] Fatal error:', error); process.exit(1); });
