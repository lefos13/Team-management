#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/server/.env.production}"
PM2_APP_NAME="${PM2_APP_NAME:-team-management}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing required env file: $ENV_FILE"
  echo "Create server/.env.production (or set ENV_FILE to an existing path) and rerun deploy."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a
echo "Using ENV_FILE=$ENV_FILE"
echo "Loaded CLIENT_ORIGIN=${CLIENT_ORIGIN:-<unset>}"

ATTACHMENTS_DIR="${ATTACHMENTS_DIR:-$PROJECT_ROOT/server/storage/attachments}"

if [[ -z "${DATABASE_URL:-}" || -z "${APP_BASE_URL:-}" || -z "${CLIENT_ORIGIN:-}" || -z "${SESSION_SECRET:-}" || -z "${EMAIL_PROVIDER:-}" || -z "${ADMIN_ACCESS_PASSWORD:-}" ]]; then
  echo "DATABASE_URL, APP_BASE_URL, CLIENT_ORIGIN, SESSION_SECRET, EMAIL_PROVIDER, and ADMIN_ACCESS_PASSWORD must be set in $ENV_FILE."
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

APP_DIR="$PROJECT_ROOT"

: <<'COMMENT'
/*
CI deploys pass DEPLOY_PREBUILT_ARTIFACT: a zstd tarball holding production
node_modules (Prisma client generated) and the built server/client bundles,
produced on the GitHub runner. The droplet then only unpacks, migrates, and
reloads, so it never runs npm install or Vite next to the live apps. Manual
runs without the variable keep the full provision + build-on-host path.
*/
COMMENT
PREBUILT_ARTIFACT="${DEPLOY_PREBUILT_ARTIFACT:-}"

# Paths the artifact owns. Nested workspace node_modules are listed so a stale
# copy from an earlier on-host install can never shadow the shipped packages.
ARTIFACT_PATHS=(node_modules server/node_modules client/node_modules packages/shared/node_modules server/dist client/dist)
STAGING_DIR="$(dirname "$APP_DIR")/.team-management-deploy-staging"

provision_host() {
  sudo apt-get update
  sudo apt-get install -y curl ca-certificates gnupg postgresql postgresql-contrib build-essential

  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  local db_host db_name db_user db_password
  db_host="$(node -e "console.log(new URL(process.argv[1]).hostname)" "$DATABASE_URL")"
  db_name="$(node -e "console.log(new URL(process.argv[1]).pathname.replace(/^\//, ''))" "$DATABASE_URL")"
  db_user="$(node -e "console.log(decodeURIComponent(new URL(process.argv[1]).username || 'postgres'))" "$DATABASE_URL")"
  db_password="$(node -e "console.log(decodeURIComponent(new URL(process.argv[1]).password || ''))" "$DATABASE_URL")"

  if ! command -v pm2 >/dev/null 2>&1; then
    sudo npm install -g pm2
  fi

  sudo systemctl enable postgresql
  sudo systemctl start postgresql
  ensure_build_swap

  if [[ "$db_host" == "127.0.0.1" || "$db_host" == "localhost" ]]; then
    sudo -u postgres psql postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$db_user') THEN
    CREATE ROLE "$db_user" LOGIN PASSWORD '$db_password';
  ELSE
    ALTER ROLE "$db_user" WITH LOGIN PASSWORD '$db_password';
  END IF;
END
\$\$;
SQL
    sudo -u postgres psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1 || sudo -u postgres createdb -O "$db_user" "$db_name"
  fi
}

build_on_host() {
  cd "$APP_DIR"
  npm install
  npx prisma generate --schema server/prisma/schema.prisma

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
}

install_prebuilt() {
  if [[ ! -f "$PREBUILT_ARTIFACT" ]]; then
    echo "DEPLOY_PREBUILT_ARTIFACT does not exist: $PREBUILT_ARTIFACT"
    exit 1
  fi

  rm -rf "$STAGING_DIR"
  mkdir -p "$STAGING_DIR/new" "$STAGING_DIR/old"
  # Lowest CPU and IO priority so unpacking never competes with the live apps.
  nice -n 19 ionice -c 3 tar --zstd -xf "$PREBUILT_ARTIFACT" -C "$STAGING_DIR/new"

  # Vite bakes the base path into the bundle; refuse a build made for another URL.
  local built_base_url
  built_base_url="$(cat "$STAGING_DIR/new/BUILD_APP_BASE_URL")"
  if [[ "$built_base_url" != "$APP_BASE_URL" ]]; then
    echo "Artifact was built for APP_BASE_URL=$built_base_url but $ENV_FILE has APP_BASE_URL=$APP_BASE_URL."
    echo "Update the APP_BASE_URL repository variable in GitHub to match."
    exit 1
  fi
  test -d "$STAGING_DIR/new/node_modules/.prisma/client"
  test -f "$STAGING_DIR/new/server/dist/index.js"
  test -f "$STAGING_DIR/new/client/dist/index.html"

  local path
  for path in "${ARTIFACT_PATHS[@]}"; do
    if [[ -e "$APP_DIR/$path" ]]; then
      mkdir -p "$(dirname "$STAGING_DIR/old/$path")"
      mv "$APP_DIR/$path" "$STAGING_DIR/old/$path"
    fi
    if [[ -e "$STAGING_DIR/new/$path" ]]; then
      mv "$STAGING_DIR/new/$path" "$APP_DIR/$path"
    fi
  done
  echo "Installed prebuilt artifact $PREBUILT_ARTIFACT"
}

cd "$APP_DIR"
if [[ -n "$PREBUILT_ARTIFACT" ]]; then
  install_prebuilt
else
  provision_host
  build_on_host
fi

mkdir -p "$ATTACHMENTS_DIR"
npx prisma migrate deploy --schema server/prisma/schema.prisma

export APP_DIR
export ENV_FILE
export PM2_APP_NAME
: <<'COMMENT'
/*
Force PM2 to refresh environment variables on every deploy so changes in
server/.env.production are applied immediately instead of keeping stale values.
*/
COMMENT
pm2 startOrReload "$APP_DIR/deploy/production/ecosystem.config.cjs" --update-env
pm2 save
if [[ -n "$PREBUILT_ARTIFACT" ]]; then
  # Previous release is only needed until the reload succeeds; delete it at idle priority.
  nice -n 19 ionice -c 3 rm -rf "$STAGING_DIR"
else
  sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null || true
fi
echo "Deployment completed. PM2 is running the API and built frontend on the same port; configure your reverse proxy separately."
