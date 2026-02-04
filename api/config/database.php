<?php
/**
 * Database Configuration — PostgreSQL
 *
 * @package x402-boilerplate
 * @since 1.0.0
 */

require_once __DIR__ . '/EnvLoader.php';

class Database {
    private $conn = null;

    /**
     * Get PostgreSQL database connection
     *
     * @return PDO
     * @throws Exception
     */
    public function getConnection(): PDO {
        if ($this->conn !== null) {
            return $this->conn;
        }

        try {
            $host = EnvLoader::get('DB_PGSQL_HOST', 'db');
            $port = EnvLoader::get('DB_PGSQL_PORT', '5432');
            $name = EnvLoader::get('DB_PGSQL_NAME', 'x402');
            $user = EnvLoader::get('DB_PGSQL_USER', 'x402');
            $pass = EnvLoader::get('DB_PGSQL_PASS', '');

            if (!$name || !$user) {
                throw new Exception('PostgreSQL credentials not configured in .env');
            }

            $dsn = "pgsql:host={$host};port={$port};dbname={$name}";
            $this->conn = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);

            return $this->conn;

        } catch (PDOException $e) {
            error_log("Database connection error: " . $e->getMessage());
            throw new Exception("Database connection failed");
        }
    }

    /**
     * Close database connection
     */
    public function closeConnection(): void {
        $this->conn = null;
    }
}
