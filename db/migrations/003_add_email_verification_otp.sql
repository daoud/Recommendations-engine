-- Migration 003: Add email verification OTP fields to users table
ALTER TABLE users
  ADD COLUMN verification_otp VARCHAR(10) NULL DEFAULT NULL,
  ADD COLUMN verification_otp_expires DATETIME NULL DEFAULT NULL;
