<?php
/**
 * x402 Payment Middleware
 *
 * Intercepts requests to payment-required endpoints.
 * If no PAYMENT-SIGNATURE header → returns 402 with PAYMENT-REQUIRED.
 * If PAYMENT-SIGNATURE present → calls facilitator /verify → /settle.
 *
 * Supports two modes:
 *   - handle()         → Escrow settlement (via X402EscrowAdapter contract)
 *   - handleTransfer() → Direct EIP-3009 transfer (buyer → treasury)
 *
 * @package x402-boilerplate
 * @since 1.0.0
 */

class X402Middleware {
    private const FACILITATOR_URL = 'http://127.0.0.1:3849';
    private const HEADER_PAYMENT_REQUIRED = 'PAYMENT-REQUIRED';
    private const HEADER_PAYMENT_SIGNATURE = 'PAYMENT-SIGNATURE';
    private const HEADER_PAYMENT_RESPONSE = 'PAYMENT-RESPONSE';

    /**
     * Handle x402 payment flow via escrow
     *
     * @param array $requirements PaymentRequirements array
     * @return array|null Returns settlement result or null if 402 sent
     */
    public static function handle(array $requirements): ?array {
        $paymentHeader = self::getPaymentHeader();

        if ($paymentHeader === null) {
            self::send402($requirements);
            return null;
        }

        $payload = json_decode(base64_decode($paymentHeader), true);
        if (!$payload) {
            Response::error('Invalid PAYMENT-SIGNATURE header', 400, 'X402_INVALID_PAYLOAD');
            exit;
        }

        $verifyResult = self::callFacilitator('/x402/verify', [
            'payload' => $payload,
            'requirements' => $requirements,
        ]);

        if (!$verifyResult || !($verifyResult['valid'] ?? false)) {
            Response::error(
                'Payment verification failed: ' . ($verifyResult['reason'] ?? 'unknown'),
                402,
                'X402_VERIFY_FAILED'
            );
            exit;
        }

        $settleResult = self::callFacilitator('/x402/settle', [
            'payload' => $payload,
            'requirements' => $requirements,
        ]);

        if (!$settleResult || !($settleResult['success'] ?? false)) {
            Response::error(
                'Payment settlement failed: ' . ($settleResult['error'] ?? 'unknown'),
                500,
                'X402_SETTLE_FAILED'
            );
            exit;
        }

        header(self::HEADER_PAYMENT_RESPONSE . ': ' . base64_encode(json_encode($settleResult)));
        return $settleResult;
    }

    /**
     * Handle x402 payment flow via direct transfer (non-escrow)
     *
     * Uses EIP-3009 transferWithAuthorization (buyer → treasury).
     *
     * @param array $requirements PaymentRequirements array
     * @return array|null Returns settlement result or null if 402 sent
     */
    public static function handleTransfer(array $requirements): ?array {
        $paymentHeader = self::getPaymentHeader();

        if ($paymentHeader === null) {
            self::send402($requirements);
            return null;
        }

        $payload = json_decode(base64_decode($paymentHeader), true);
        if (!$payload) {
            Response::error('Invalid PAYMENT-SIGNATURE header', 400, 'X402_INVALID_PAYLOAD');
            exit;
        }

        $verifyResult = self::callFacilitator('/x402/verify-transfer', [
            'payload' => $payload,
            'requirements' => $requirements,
        ]);

        if (!$verifyResult || !($verifyResult['valid'] ?? false)) {
            Response::error(
                'Payment verification failed: ' . ($verifyResult['reason'] ?? 'unknown'),
                402,
                'X402_VERIFY_FAILED'
            );
            exit;
        }

        $settleResult = self::callFacilitator('/x402/settle-transfer', [
            'payload' => $payload,
            'requirements' => $requirements,
        ]);

        if (!$settleResult || !($settleResult['success'] ?? false)) {
            Response::error(
                'Payment settlement failed: ' . ($settleResult['error'] ?? 'unknown'),
                500,
                'X402_SETTLE_FAILED'
            );
            exit;
        }

        header(self::HEADER_PAYMENT_RESPONSE . ': ' . base64_encode(json_encode($settleResult)));
        return $settleResult;
    }

    private static function getPaymentHeader(): ?string {
        $headers = getallheaders();
        return $headers[self::HEADER_PAYMENT_SIGNATURE]
            ?? $headers['Payment-Signature']
            ?? $headers['payment-signature']
            ?? null;
    }

    private static function send402(array $requirements): void {
        http_response_code(402);
        header('Content-Type: application/json');
        header(self::HEADER_PAYMENT_REQUIRED . ': ' . base64_encode(json_encode([$requirements])));

        echo json_encode([
            'success' => false,
            'message' => 'Payment Required',
            'error_code' => 'X402_PAYMENT_REQUIRED',
            'x402Version' => 2,
        ]);
        exit;
    }

    private static function callFacilitator(string $endpoint, array $data): ?array {
        $ch = curl_init(self::FACILITATOR_URL . $endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-API-Key: ' . EnvLoader::get('X402_FACILITATOR_KEY', ''),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 && $httpCode !== 402) {
            return null;
        }

        return json_decode($response, true);
    }
}
