-- Migration 002: Add password reset token fields to users table
-- Run this on the EC2 MySQL instance to support the forgot-password feature

ALTER TABLE users
  ADD COLUMN password_reset_token VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN password_reset_expires DATETIME NULL DEFAULT NULL;
