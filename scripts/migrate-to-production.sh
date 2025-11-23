#!/bin/bash

# Migration script to copy development database to production
# This script uses pg_dump and pg_restore for reliable migration

set -e

echo "🔄 Starting database migration..."

# Production database URL
PROD_DB_URL="postgresql://neondb_owner:npg_Ft12ZTswrQiX@ep-dark-band-afb5owag.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require"

# Development database URL (from Replit)
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  exit 1
fi

DEV_DB_URL="$DATABASE_URL"

echo "📤 Dumping development database schema and data..."
pg_dump "$DEV_DB_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --on-conflict-do-nothing \
  > /tmp/db_dump.custom

if [ ! -f /tmp/db_dump.custom ]; then
  echo "❌ Failed to create database dump"
  exit 1
fi

DUMP_SIZE=$(du -h /tmp/db_dump.custom | cut -f1)
echo "✅ Database dump created (Size: $DUMP_SIZE)"

echo "📥 Connecting to production database..."
psql "$PROD_DB_URL" -c "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Failed to connect to production database"
  exit 1
fi
echo "✅ Connected to production database"

echo "🔨 Restoring data to production database..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$PROD_DB_URL" \
  /tmp/db_dump.custom

if [ $? -eq 0 ]; then
  echo "✅ Database migration completed successfully!"
  rm /tmp/db_dump.custom
else
  echo "❌ Migration failed during restore"
  exit 1
fi

# Verify migration
echo ""
echo "🔍 Verifying migration..."
DEV_TABLE_COUNT=$(psql "$DEV_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
PROD_TABLE_COUNT=$(psql "$PROD_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")

echo "Development database tables: $DEV_TABLE_COUNT"
echo "Production database tables: $PROD_TABLE_COUNT"

if [ "$DEV_TABLE_COUNT" -eq "$PROD_TABLE_COUNT" ]; then
  echo "✅ Table count matches!"
else
  echo "⚠️  Table count mismatch - please verify"
fi
