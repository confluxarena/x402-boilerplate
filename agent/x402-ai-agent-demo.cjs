#!/usr/bin/env node
/**
 * x402 AI Agent Demo — Autonomous Machine-to-Machine Payment
 *
 * Cinematic terminal demo: AI agent autonomously pays USDT0 via x402 protocol
 * to get AI responses. Designed for hackathon video recordings.
 *
 * Usage:
 *   DEMO_BUYER_KEY=0x... node x402-ai-agent-demo.cjs "What is Conflux?"
 *
 * @package ConfluxArena
 * @version 2.0.0
 * @since 2026-02-03
 */

const { ethers } = require('ethers');

// ============================================
// CONFIGURATION
// ============================================

const API_URL = process.env.API_URL || 'https://confluxarena.org/api/x402/ai.php';
const RPC_URL = 'https://evm.confluxrpc.com';
const CHAIN_ID = 1030;
const CONFLUXSCAN = 'https://evm.confluxscan.io/tx/';

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
// TERMINAL COLORS & HELPERS
// ============================================

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function stepHeader(num, total, icon, title) {
    console.log('');
    console.log(
        `  ${c.bgBlue}${c.white}${c.bold} STEP ${num}/${total} ${c.reset}  ${icon}  ${c.bold}${title}${c.reset}`
    );
    console.log(`  ${c.dim}${'─'.repeat(50)}${c.reset}`);
}

function kv(key, value, valueColor = c.white) {
    console.log(`  ${c.dim}${key.padEnd(14)}${c.reset}${valueColor}${value}${c.reset}`);
}

// ============================================
// MAIN
// ============================================

async function main() {
    const question = process.argv[2] || 'What is Conflux Network?';

    const buyerKey = process.env.DEMO_BUYER_KEY;
    if (!buyerKey) {
        console.error(`${c.red}Error: DEMO_BUYER_KEY environment variable required${c.reset}`);
        console.error(`  export DEMO_BUYER_KEY=0xYourPrivateKey`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(buyerKey, provider);

    // ── Banner ──
    console.log('');
    console.log(`${c.cyan}${c.bold}`);
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║                                                      ║');
    console.log('  ║   x402 Protocol — AI Agent Demo                      ║');
    console.log('  ║   Machine-to-Machine Payment on Conflux eSpace       ║');
    console.log('  ║                                                      ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log(`${c.reset}`);

    kv('Agent', wallet.address.substring(0, 6) + '...' + wallet.address.substring(38), c.cyan);
    kv('Network', 'Conflux eSpace (chain 1030)', c.blue);
    kv('API', API_URL, c.dim);
    kv('Question', question, c.yellow);

    await sleep(1500);

    // ════════════════════════════════════════════
    // STEP 1: Request API → 402
    // ════════════════════════════════════════════

    stepHeader(1, 4, '\u{1F310}', 'Requesting AI API...');
    await sleep(500);

    const url = `${API_URL}?q=${encodeURIComponent(question)}`;
    kv('GET', url.substring(0, 55) + '...', c.dim);
    await sleep(800);

    const firstResponse = await fetch(url);

    if (firstResponse.status !== 402) {
        console.error(`${c.red}  Unexpected status: ${firstResponse.status}${c.reset}`);
        const body = await firstResponse.text();
        console.error(body);
        process.exit(1);
    }

    const paymentRequiredHeader = firstResponse.headers.get('PAYMENT-REQUIRED');
    if (!paymentRequiredHeader) {
        console.error(`${c.red}  Missing PAYMENT-REQUIRED header${c.reset}`);
        process.exit(1);
    }

    const requirements = JSON.parse(Buffer.from(paymentRequiredHeader, 'base64').toString())[0];
    const amountHuman = parseInt(requirements.amount) / 1e6;

    console.log('');
    console.log(
        `  ${c.bgYellow}${c.bold} HTTP 402 ${c.reset}  ${c.yellow}Payment Required${c.reset}`
    );
    kv('Price', `${amountHuman} USDT0`, c.yellow);
    kv('Pay to', requirements.payTo.substring(0, 10) + '...', c.dim);
    kv('Settlement', requirements.extra?.settlementMode || 'transfer', c.magenta);
    kv('Standard', 'EIP-3009 transferWithAuthorization', c.dim);

    await sleep(1500);

    // ════════════════════════════════════════════
    // STEP 2: Check balance
    // ════════════════════════════════════════════

    stepHeader(2, 4, '\u{1F4B0}', 'Checking USDT0 balance...');
    await sleep(500);

    const erc20 = new ethers.Contract(
        requirements.asset,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    );
    const balance = await erc20.balanceOf(wallet.address);
    const requiredAmount = BigInt(requirements.amount);
    const balanceHuman = ethers.formatUnits(balance, 6);

    kv('Balance', `${balanceHuman} USDT0`, c.green);
    kv('Required', `${amountHuman} USDT0`, c.yellow);

    if (balance < requiredAmount) {
        console.log(`\n  ${c.bgRed}${c.white} INSUFFICIENT BALANCE ${c.reset}`);
        process.exit(1);
    }

    console.log(`\n  ${c.green}\u2713 Sufficient balance${c.reset}`);

    await sleep(1200);

    // ════════════════════════════════════════════
    // STEP 3: Sign EIP-3009
    // ════════════════════════════════════════════

    stepHeader(3, 4, '\u{270D}\u{FE0F}', 'Signing EIP-3009 payment...');
    await sleep(500);

    const now = Math.floor(Date.now() / 1000);
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    const domain = {
        name: requirements.extra?.name || 'USDT0',
        version: requirements.extra?.version || '1',
        chainId: CHAIN_ID,
        verifyingContract: requirements.asset,
    };

    const message = {
        from: wallet.address,
        to: requirements.payTo,
        value: requirements.amount,
        validAfter: 0,
        validBefore: now + 3600,
        nonce: nonce,
    };

    kv('Type', 'EIP-712 Typed Data (TransferWithAuthorization)', c.dim);
    kv('From', wallet.address.substring(0, 10) + '...', c.cyan);
    kv('To', requirements.payTo.substring(0, 10) + '... (treasury)', c.cyan);
    kv('Value', `${amountHuman} USDT0`, c.yellow);
    kv('Nonce', nonce.substring(0, 18) + '...', c.dim);
    kv('Expires', 'in 1 hour', c.dim);

    await sleep(600);

    const signature = await wallet.signTypedData(domain, TRANSFER_AUTH_TYPES, message);

    console.log('');
    console.log(`  ${c.green}\u2713 Signature: ${signature.substring(0, 22)}...${c.reset}`);

    const x402Payload = {
        x402Version: 2,
        scheme: 'exact',
        network: `eip155:${CHAIN_ID}`,
        payload: {
            signature: signature,
            authorization: {
                from: wallet.address,
                to: requirements.payTo,
                value: requirements.amount,
                validAfter: '0',
                validBefore: String(now + 3600),
                nonce: nonce,
            },
        },
    };

    const paymentSignature = Buffer.from(JSON.stringify(x402Payload)).toString('base64');

    await sleep(1200);

    // ════════════════════════════════════════════
    // STEP 4: Pay & get answer
    // ════════════════════════════════════════════

    stepHeader(4, 4, '\u{1F680}', 'Sending paid request...');
    await sleep(500);

    kv('Header', 'PAYMENT-SIGNATURE: <base64 payload>', c.dim);
    console.log(`  ${c.dim}Waiting for on-chain settlement...${c.reset}`);

    const paidResponse = await fetch(url, {
        headers: { 'PAYMENT-SIGNATURE': paymentSignature },
    });

    const responseBody = await paidResponse.json();

    if (paidResponse.status !== 200 || !responseBody.success) {
        console.log(`\n  ${c.bgRed}${c.white} PAYMENT FAILED ${c.reset}`);
        console.error(JSON.stringify(responseBody, null, 2));
        process.exit(1);
    }

    await sleep(300);
    console.log(`\n  ${c.bgGreen}${c.white}${c.bold} HTTP 200 — PAID & SETTLED ${c.reset}`);

    await sleep(1000);

    // ── Payment receipt ──
    console.log('');
    console.log(`${c.green}${c.bold}`);
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║              PAYMENT RECEIPT                         ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log(`${c.reset}`);

    const txHash = responseBody.data.payment.tx_hash;
    kv('TX Hash', txHash, c.green);
    kv('Payer', responseBody.data.payment.payer, c.cyan);
    kv('Amount', `${responseBody.data.payment.amount} ${responseBody.data.payment.token}`, c.yellow);
    kv('Tokens used', `${responseBody.data.tokens_used}`, c.dim);
    kv('ConfluxScan', `${CONFLUXSCAN}${txHash}`, c.blue);

    await sleep(1500);

    // ── AI answer ──
    console.log('');
    console.log(`${c.cyan}${c.bold}`);
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║              AI RESPONSE                             ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log(`${c.reset}`);
    console.log('');

    // Typewriter effect for the answer
    const answer = responseBody.data.answer;
    const words = answer.split(' ');
    let line = '  ';
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (stripAnsi(line).length + word.length + 1 > 60) {
            console.log(line);
            line = '  ';
            await sleep(40);
        }
        line += (line.trim() ? ' ' : '') + word;
    }
    if (line.trim()) console.log(line);

    await sleep(800);

    // ── Footer ──
    console.log('');
    console.log(`  ${c.dim}${'─'.repeat(56)}${c.reset}`);
    console.log(
        `  ${c.dim}No registration. No credit card. No subscription.${c.reset}`
    );
    console.log(
        `  ${c.dim}Just a wallet, a stablecoin, and an API.${c.reset}`
    );
    console.log(
        `  ${c.bold}  Powered by x402 Protocol on Conflux eSpace${c.reset}`
    );
    console.log('');
}

main().catch((error) => {
    console.error(`\n${c.red}Fatal: ${error.message}${c.reset}`);
    process.exit(1);
});
