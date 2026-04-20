/* Bootstrap a local PostgreSQL database before starting the watch server so npm run dev works on a fresh machine. */
import "dotenv/config";

import { spawn, spawnSync } from "node:child_process";

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);

  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || ""),
  };
}

function ensureLocalPostgresDatabase(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    return;
  }

  if (parsed.host !== "127.0.0.1" && parsed.host !== "localhost") {
    return;
  }

  const env = {
    ...process.env,
    PGPASSWORD: parsed.password,
  };

  const existsCheck = spawnSync(
    "psql",
    [
      "-h",
      parsed.host,
      "-p",
      parsed.port,
      "-U",
      parsed.user,
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname='${parsed.database}'`,
    ],
    {
      encoding: "utf8",
      env,
    },
  );

  if (existsCheck.status !== 0) {
    throw new Error("Unable to connect to PostgreSQL. Make sure your local PostgreSQL server is running.");
  }

  if (existsCheck.stdout.trim() !== "1") {
    run(
      "createdb",
      ["-h", parsed.host, "-p", parsed.port, "-U", parsed.user, parsed.database],
      env,
    );
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  ensureLocalPostgresDatabase(databaseUrl);
  run("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    ...process.env,
    DATABASE_URL: databaseUrl,
  });

  const child = spawn("npx", ["tsx", "watch", "src/index.ts"], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
