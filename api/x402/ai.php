<?php
/**
 * x402 Paid AI API Endpoint
 *
 * AI question-answering endpoint protected by x402 protocol.
 * Payment: 0.0001 USDT0 per request via direct EIP-3009 transfer (buyer → treasury).
 *
 * Usage:
 *   GET /api/x402/ai.php?q=What+is+Conflux
 *   → First request: 402 + PAYMENT-REQUIRED header
 *   → With PAYMENT-SIGNATURE: 200 + AI answer
 *
 * @package x402-boilerplate
 * @since 1.0.0
 */

require_once __DIR__ . '/../middleware/X402Middleware.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/EnvLoader.php';
require_once __DIR__ . '/../utils/response.php';

EnvLoader::load();

// x402 CORS: allow any origin (agents/scripts need access)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, PAYMENT-SIGNATURE');
header('Access-Control-Expose-Headers: PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Amount, X-Payment-Token, X-Payment-Nonce, X-Payment-Expiry, X-Payment-Endpoint, X-Payment-Invoice-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405, 'OP_METHOD_NOT_ALLOWED');
}

// Configuration
$treasury = EnvLoader::get('X402_API_TREASURY', '');
$price = (int) EnvLoader::get('X402_API_PRICE', '100'); // 0.0001 USDT0 (6 decimals)
$claudeApiKey = EnvLoader::get('CLAUDE_API_KEY', '');
$claudeModel = EnvLoader::get('CLAUDE_MODEL', 'claude-3-5-haiku-20241022');

if (empty($treasury)) {
    Response::error('Treasury address not configured', 503, 'SRV_SERVICE_UNAVAILABLE');
}

// Validate question
$question = trim($_GET['q'] ?? '');
if (empty($question)) {
    Response::error('Query parameter "q" is required', 422, 'VAL_REQUIRED_FIELD');
}
if (strlen($question) > 500) {
    Response::error('Question too long (max 500 characters)', 422, 'VAL_INVALID_FORMAT');
}

// Build x402 payment requirements
$requirements = [
    'scheme' => 'exact',
    'network' => 'eip155:1030',
    'amount' => (string) $price,
    'asset' => '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff', // USDT0 on Conflux eSpace
    'payTo' => $treasury,
    'extra' => [
        'settlementMode' => 'transfer',
        'name' => 'USDT0',
        'version' => '1',
        'description' => 'AI API query — 0.0001 USDT0 per request',
    ],
];

// x402 payment gate
$settlement = X402Middleware::handleTransfer($requirements);

// If we reach here, payment was successful
if (!$settlement) {
    exit; // 402 was already sent
}

// Call Claude API
if (empty($claudeApiKey)) {
    Response::error('AI service not configured', 503, 'SRV_SERVICE_UNAVAILABLE');
}

$systemPrompt = <<<'PROMPT'
You are a helpful AI assistant. You specialize in:
- Conflux Network (eSpace, Core Space, PoW+PoS consensus, CFX token)
- PayFi (Payment Finance) and escrow systems
- x402 protocol for machine-to-machine payments
- DeFi concepts (DEX, staking, liquidity, yield farming)
- Web3, blockchain, and smart contracts

Keep answers concise (under 200 words). Be accurate and technical when needed.
If the question is unrelated to crypto/blockchain, still answer helpfully but briefly.
PROMPT;

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode([
        'model' => $claudeModel,
        'max_tokens' => 300,
        'system' => $systemPrompt,
        'messages' => [
            ['role' => 'user', 'content' => $question],
        ],
    ]),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . $claudeApiKey,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    error_log("[x402 AI] Curl error: $curlError");
    Response::error('AI service unavailable', 503, 'SRV_SERVICE_UNAVAILABLE');
}

if ($httpCode !== 200) {
    error_log("[x402 AI] Anthropic API error ($httpCode): $response");
    Response::error('AI service error', 502, 'SRV_EXTERNAL_ERROR');
}

$result = json_decode($response, true);
$answer = $result['content'][0]['text'] ?? '';
$tokensUsed = ($result['usage']['input_tokens'] ?? 0) + ($result['usage']['output_tokens'] ?? 0);

if (empty($answer)) {
    error_log("[x402 AI] Empty answer from Anthropic");
    Response::error('AI returned empty response', 502, 'SRV_EXTERNAL_ERROR');
}

// Log payment to database
try {
    $database = new Database();
    $db = $database->getConnection();

    $stmt = $db->prepare("
        INSERT INTO x402_api_payments (endpoint, payer_address, asset_address, amount, tx_hash, question, answer_length, tokens_used)
        VALUES (:endpoint, :payer, :asset, :amount, :tx_hash, :question, :answer_length, :tokens_used)
    ");
    $stmt->execute([
        'endpoint' => '/api/x402/ai',
        'payer' => $settlement['payer'] ?? '',
        'asset' => '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff',
        'amount' => (string) $price,
        'tx_hash' => $settlement['transaction'] ?? '',
        'question' => $question,
        'answer_length' => strlen($answer),
        'tokens_used' => $tokensUsed,
    ]);
} catch (Exception $e) {
    // Don't fail the request if logging fails
    error_log("[x402 AI] DB log error: " . $e->getMessage());
}

// Return answer
Response::success([
    'answer' => $answer,
    'model' => $claudeModel,
    'tokens_used' => $tokensUsed,
    'payment' => [
        'tx_hash' => $settlement['transaction'] ?? null,
        'payer' => $settlement['payer'] ?? null,
        'amount' => '0.0001',
        'token' => 'USDT0',
    ],
]);
