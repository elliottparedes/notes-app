-- Add password reset functionality to users table
ALTER TABLE users 
ADD COLUMN temporary_password VARCHAR(255) DEFAULT NULL,
ADD COLUMN temporary_password_expires_at DATETIME DEFAULT NULL;

-- Add index for faster lookups during password reset
CREATE INDEX idx_users_temp_password_expires ON users(temporary_password_expires_at);



