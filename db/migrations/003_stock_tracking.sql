-- Run ONLY if you already have a database from an earlier version. Keeps your data.
USE canteen_db;
ALTER TABLE menu_items ADD COLUMN stock_quantity INT NOT NULL DEFAULT 50;
