-- Run ONLY if you already have a database from an earlier version. Keeps your data.
USE canteen_db;
ALTER TABLE menu_items ADD COLUMN prepared_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN ready_stock_order INT NOT NULL DEFAULT 0;
