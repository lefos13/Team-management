#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/server/.env.production}"
PM2_APP_NAME="${PM2_APP_NAME:-team-management}"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$PROJECT_ROOT/server/.env.production.example" "$ENV_FILE"
  echo "Created $ENV_FILE. Fill in the production values and rerun the deploy script."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

ATTACHMENTS_DIR="${ATTACHMENTS_DIR:-$PROJECT_ROOT/server/storage/attachments}"

if [[ -z "${DATABASE_URL:-}" || -z "${APP_BASE_URL:-}" || -z "${CLIENT_ORIGIN:-}" || -z "${SESSION_SECRET:-}" || -z "${EMAIL_PROVIDER:-}" ]]; then
  echo "DATABASE_URL, APP_BASE_URL, CLIENT_ORIGIN, SESSION_SECRET, and EMAIL_PROVIDER must be set in $ENV_FILE."
  exit 1
fi

if [[ "$EMAIL_PROVIDER" == "gmail" ]]; then
  if [[ -z "${GMAIL_USER:-}" || -z "${GMAIL_APP_PASSWORD:-}" || -z "${EMAIL_FROM:-}" || -z "${EMAIL_REPLY_TO:-}" ]]; then
    echo "GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_FROM, and EMAIL_REPLY_TO must be set when EMAIL_PROVIDER=gmail."
    exit 1
  fi
fi

if [[ "$EMAIL_PROVIDER" == "smtp" ]]; then
  if [[ -z "${SMTP_HOST:-}" || -z "${SMTP_USER:-}" || -z "${SMTP_PASS:-}" || -z "${EMAIL_FROM:-}" ]]; then
    echo "SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM must be set when EMAIL_PROVIDER=smtp."
    exit 1
  fi
fi

: <<'COMMENT'
/*
On small hosts the client bundle can be terminated by the kernel while Vite is
optimizing thousands of modules. This provisions swap only when RAM is low and
no useful swap already exists, so the deploy can finish without requiring a
larger droplet or a separate build machine.
*/
COMMENT
ensure_build_swap() {
  if [[ "${DEPLOY_SKIP_SWAP_SETUP:-0}" == "1" ]]; then
    return
  fi

  local mem_total_kb
  local swap_total_kb
  local swap_target_mb=2048
  local swap_file="/swapfile"

  mem_total_kb="$(awk '/MemTotal/ { print $2 }' /proc/meminfo)"
  swap_total_kb="$(awk '/SwapTotal/ { print $2 }' /proc/meminfo)"

  if (( mem_total_kb > 1572864 )) || (( swap_total_kb >= 1048576 )); then
    return
  fi

  if [[ ! -f "$swap_file" ]]; then
    sudo fallocate -l "${swap_target_mb}M" "$swap_file" || sudo dd if=/dev/zero of="$swap_file" bs=1M count="$swap_target_mb" status=progress
    sudo chmod 600 "$swap_file"
    sudo mkswap "$swap_file"
  fi

  if ! sudo swapon --show=NAME --noheadings | grep -Fxq "$swap_file"; then
    sudo swapon "$swap_file"
  fi

  if ! grep -qE '^[^#]*\s+/swapfile\s+' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
}

sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg postgresql postgresql-contrib build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

APP_DIR="$PROJECT_ROOT"
DB_HOST="$(node -e "console.log(new URL(process.argv[1]).hostname)" "$DATABASE_URL")"
DB_PORT="$(node -e "console.log(new URL(process.argv[1]).port || '5432')" "$DATABASE_URL")"
DB_NAME="$(node -e "console.log(new URL(process.argv[1]).pathname.replace(/^\//, ''))" "$DATABASE_URL")"
DB_USER="$(node -e "console.log(decodeURIComponent(new URL(process.argv[1]).username || 'postgres'))" "$DATABASE_URL")"
DB_PASSWORD="$(node -e "console.log(decodeURIComponent(new URL(process.argv[1]).password || ''))" "$DATABASE_URL")"

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

sudo systemctl enable postgresql
sudo systemctl start postgresql
ensure_build_swap

if [[ "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ]]; then
  sudo -u postgres psql postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE "$DB_USER" WITH LOGIN PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SQL
  sudo -u postgres psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

cd "$APP_DIR"
npm install
npx prisma generate --schema server/prisma/schema.prisma
mkdir -p "$ATTACHMENTS_DIR"

: <<'COMMENT'
/*
The client build is the only part that spikes memory on constrained servers, so
the deploy keeps the server and shared builds unchanged and limits the Node heap
only for the frontend bundle step.
*/
COMMENT
npm run build --workspace @team-management/shared
npm run build --workspace server
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}" npm run build --workspace client
npx prisma migrate deploy --schema server/prisma/schema.prisma

export APP_DIR
export ENV_FILE
export PM2_APP_NAME
pm2 startOrReload "$APP_DIR/deploy/production/ecosystem.config.cjs"
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null || true
echo "Deployment completed. PM2 is running the API and built frontend on the same port; configure your reverse proxy separately."
