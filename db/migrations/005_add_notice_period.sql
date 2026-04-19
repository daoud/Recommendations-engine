-- Migration 005: Add notice period fields
ALTER TABLE profiles
  ADD COLUMN notice_period VARCHAR(20) NULL DEFAULT NULL;

ALTER TABLE users
  ADD COLUMN preferred_notice_period VARCHAR(20) NULL DEFAULT NULL;
