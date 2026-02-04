<?php
/**
 * x402 AI Demo Proxy — Server-side payment for web demo page
 *
 * This endpoint runs the full x402 flow server-side:
 *   1. Calls ai.php → gets 402 + requirements
 *   2. Signs EIP-3009 transferWithAuthorization using DEMO_BUYER_KEY
 *   3. Retries with PAYMENT-SIGNATURE → returns AI answer
 *
 * The demo page calls this instead of signing in the browser
 * (private keys never leave the server).
 *
 * Rate limited: 5 requests per minute per IP.
 *
 * POST /api/x402/ai-demo-proxy.php
 * Body: { "question": "What is Conflux?" }
 *
 * @package x402-boilerplate
 * @since 1.0.0
 */

require_once __DIR__ . '/../config/EnvLoader.php';
require_once __DIR__ . '/../utils/response.php';

EnvLoader::load();

// CORS — configurable via .env
$allowedOrigin = EnvLoader::get('APP_URL', 'http://localhost');
header("Access-Control-Allow-Origin: $allowedOrigin");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405, 'OP_METHOD_NOT_ALLOWED');
}

// Rate limit: 5 req/min per IP
$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = sys_get_temp_dir() . '/x402_demo_' . md5($ip) . '.json';
$rateData = [];
if (file_exists($rateLimitFile)) {
    $rateData = json_decode(file_get_contents($rateLimitFile), true) ?: [];
}
$now = time();
$rateData = array_filter($rateData, fn($t) => $t > $now - 60);
if (count($rateData) >= 5) {
    Response::error('Rate limit exceeded. Max 5 requests per minute.', 429, 'OP_RATE_LIMIT');
}
$rateData[] = $now;
file_put_contents($rateLimitFile, json_encode($rateData));

// Parse input
$input = json_decode(file_get_contents('php://input'), true);
$question = trim($input['question'] ?? '');

if (empty($question)) {
    Response::error('Question is required', 422, 'VAL_REQUIRED_FIELD');
}
if (strlen($question) > 500) {
    Response::error('Question too long (max 500 chars)', 422, 'VAL_INVALID_FORMAT');
}

// Call the Node.js facilitator to do the full x402 flow
$facilitatorUrl = 'http://127.0.0.1:3849/x402/demo-ai';

$ch = curl_init($facilitatorUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode(['question' => $question]),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Facilitator-Key: ' . EnvLoader::get('X402_FACILITATOR_KEY', ''),
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 45,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    error_log("[x402 demo proxy] Curl error: $curlError");
    Response::error('Demo service unavailable', 503, 'SRV_SERVICE_UNAVAILABLE');
}

if ($httpCode !== 200) {
    error_log("[x402 demo proxy] Facilitator returned $httpCode: $response");
    $parsed = json_decode($response, true);
    Response::error($parsed['message'] ?? 'Demo service error', $httpCode >= 400 ? $httpCode : 502, 'SRV_EXTERNAL_ERROR');
}

// Pass through the facilitator response
$result = json_decode($response, true);
if (!$result || !isset($result['success'])) {
    Response::error('Invalid response from demo service', 502, 'SRV_EXTERNAL_ERROR');
}

http_response_code(200);
echo json_encode($result);
