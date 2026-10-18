-- Run ONLY if you already have a database from an earlier version. Keeps your data.
USE canteen_db;
ALTER TABLE orders ADD COLUMN stock_reserved INT NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN prepared_quantity_reserved INT NOT NULL DEFAULT 0;
