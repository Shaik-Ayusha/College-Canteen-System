-- Run ONLY if you already have a database from an earlier version. Keeps your data.
USE canteen_db;
ALTER TABLE orders ADD COLUMN pickup_time TIME NULL;
