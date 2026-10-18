-- Run ONLY if you already have a database from an earlier version. Keeps your data.
USE canteen_db;
ALTER TABLE menu_items ADD COLUMN cooked_today_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN cooked_quantity_date DATE NULL;
