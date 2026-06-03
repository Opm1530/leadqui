#!/bin/bash
set -e

# Garantir que a rede Docker interna existe
docker network inspect docker_internal >/dev/null 2>&1 \
  || docker network create docker_internal

git pull && docker compose up -d --build
