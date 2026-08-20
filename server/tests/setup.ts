// Non-production test environment defaults
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_minimum_32_bytes_long_123456';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_secret_minimum_32_bytes_long_123456';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_minimum_32_bytes_123456';
process.env.DB_USER = process.env.DB_USER || 'NEXA_USER';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'TestSecurePassword123!';
process.env.DB_CONNECT_STRING = process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1';
