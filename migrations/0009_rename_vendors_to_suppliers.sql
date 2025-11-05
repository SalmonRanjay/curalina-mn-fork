-- Migration: Rename vendors table to suppliers
-- This migration renames the vendors table to suppliers and updates all related foreign keys

-- Rename the table
ALTER TABLE vendors RENAME TO suppliers;

-- Rename the foreign key column in products table
ALTER TABLE products RENAME COLUMN vendor_id TO supplier_id;

-- Update constraint names if they exist (Postgres auto-generates these)
-- The foreign key constraint will automatically follow the table rename
