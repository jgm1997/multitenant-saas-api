#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: npm run migrate -- <migration_name>"
  echo "Example: npm run migrate -- add_users_table"
  exit 1
fi

MIGRATIONS_DIR="prisma/migrations"
NAME="$1"

COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
NEXT=$(printf "%04d" $((COUNT + 1)))
FULL_NAME="${NEXT}_${NAME}"

# Generate SQL without applying so we can rename first
npx prisma migrate dev --create-only --name "$FULL_NAME"

# Prisma prepends a timestamp — find and strip it
CREATED=$(find "$MIGRATIONS_DIR" -maxdepth 1 -mindepth 1 -type d | sort | tail -1)
TARGET="$MIGRATIONS_DIR/$FULL_NAME"

if [ "$CREATED" != "$TARGET" ]; then
  mv "$CREATED" "$TARGET"
fi

# Apply the renamed migration
npx prisma migrate dev
