/* Own the PostgreSQL test lifecycle so vitest always runs against a migrated disposable database instance. */
import { spawnSync } from "node:child_process";

const databaseUrl = "postgresql://postgres@127.0.0.1:55432/team_management_test?schema=public";

function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

try {
  run("npx", ["tsx", "scripts/manage-test-db.ts", "start"], process.env);
  run("npx", ["prisma", "migrate", "deploy"], {
    ...process.env,
    DATABASE_URL: databaseUrl,
  });
  run("npx", ["vitest", "run"], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    CLIENT_ORIGIN: "http://localhost:5173",
    APP_BASE_URL: "http://localhost:5173",
    SESSION_SECRET: "replace-with-a-long-random-string",
    EMAIL_PROVIDER: "json",
    OTP_OVERRIDE_CODE: "123456",
  });
} finally {
  spawnSync("npx", ["tsx", "scripts/manage-test-db.ts", "stop"], {
    stdio: "inherit",
    env: process.env,
  });
}
