#!/bin/sh
set -e

echo "🍈 Rodando migrations..."
npx prisma migrate deploy

echo "🚀 Iniciando API..."
exec node dist/server.js
