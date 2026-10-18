-- Run this ONLY if you already created the database from an earlier version.
-- Keeps your existing data.
USE canteen_db;
ALTER TABLE menu_items ADD COLUMN prep_minutes INT NOT NULL DEFAULT 5;
ALTER TABLE orders ADD COLUMN prep_minutes INT NOT NULL DEFAULT 0;
