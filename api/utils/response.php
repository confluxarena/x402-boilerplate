<?php
/**
 * API Response utilities
 *
 * @package x402-boilerplate
 * @since 1.0.0
 */

class Response {
    /**
     * Send JSON response
     */
    public static function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        ini_set('serialize_precision', 14);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit();
    }

    /**
     * Send success response
     */
    public static function success($data = null, $message = 'Success') {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], 200);
    }

    /**
     * Send error response
     *
     * @param string $message Error message
     * @param int $statusCode HTTP status code
     * @param string|null $errorCode Machine-readable error code
     * @param array|null $errors Additional error details
     */
    public static function error($message, $statusCode = 400, $errorCode = null, $errors = null) {
        $response = [
            'success' => false,
            'message' => $message
        ];

        if ($errorCode) {
            $response['error_code'] = $errorCode;
        }

        if ($errors) {
            $response['errors'] = $errors;
        }

        self::json($response, $statusCode);
    }
}
