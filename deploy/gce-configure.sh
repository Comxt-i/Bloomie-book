#!/usr/bin/env bash
set -euo pipefail

domain="${1:-}"
if [[ ! "$domain" =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ ]] || [[ "$domain" != *.* ]]; then
  echo 'Usage: bash deploy/gce-configure.sh example.com' >&2
  exit 2
fi

cd "$(dirname "$0")/.."
if [[ -e .env.deploy ]]; then
  echo '.env.deploy already exists; preserving its secrets' >&2
  exit 1
fi

umask 077
temp_env="$(mktemp .env.deploy.XXXXXX)"
trap 'rm -f "$temp_env"' EXIT
{
  printf 'APP_DOMAIN=%s\n' "$domain"
  printf 'POSTGRES_DB=punaan\n'
  printf 'POSTGRES_USER=punaan\n'
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'ML_MODEL_PATH=\n'
  printf 'ADMIN_USER_IDS=\n'
} > "$temp_env"
mv "$temp_env" .env.deploy
trap - EXIT
echo 'Created .env.deploy with private random credentials.'
