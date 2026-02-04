<?php
/**
 * EnvLoader - Environment Variables Loader
 *
 * Loads environment variables from .env file for secure configuration management.
 *
 * @package x402-boilerplate
 * @since 1.0.0
 */

class EnvLoader {
    private static $loaded = false;
    private static $vars = [];

    /**
     * Load environment variables from .env file
     */
    public static function load() {
        if (self::$loaded) {
            return;
        }

        $envFile = __DIR__ . '/../../.env';

        if (!file_exists($envFile)) {
            error_log("EnvLoader: .env file not found at $envFile");
            return;
        }

        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            if (strpos($line, '=') === false) {
                continue;
            }

            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);

            // Remove quotes if present
            if (preg_match('/^(["\']).*\1$/', $value)) {
                $value = substr($value, 1, -1);
            }

            self::$vars[$name] = $value;

            if (getenv($name) === false) {
                putenv("$name=$value");
            }

            if (!isset($_ENV[$name])) {
                $_ENV[$name] = $value;
            }
        }

        self::$loaded = true;
    }

    /**
     * Get environment variable value
     */
    public static function get($key, $default = null) {
        self::load();

        if (isset(self::$vars[$key])) {
            return self::$vars[$key];
        }

        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }

        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }

        return $default;
    }

    /**
     * Get required environment variable (throws exception if missing)
     */
    public static function require($key) {
        $value = self::get($key);

        if ($value === null || $value === '') {
            throw new Exception("Required environment variable '$key' is not set");
        }

        return $value;
    }

    /**
     * Check if environment variable exists
     */
    public static function has($key) {
        self::load();
        return self::get($key) !== null;
    }
}
