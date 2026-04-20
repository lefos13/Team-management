/* Start and stop an isolated PostgreSQL instance in /tmp so tests run against the real Prisma provider. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const command = process.argv[2];
const pgData = "/tmp/team-management-pg-test";
const port = "55432";
const databaseName = "team_management_test";

function run(commandName: string, args: string[]) {
  execFileSync(commandName, args, {
    stdio: "inherit",
  });
}

function isServerRunning() {
  try {
    execFileSync("pg_ctl", ["-D", pgData, "status"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function start() {
  mkdirSync(pgData, { recursive: true });

  if (!existsSync(`${pgData}/PG_VERSION`)) {
    run("initdb", ["-D", pgData, "-A", "trust", "-U", "postgres"]);
  }

  if (!isServerRunning()) {
    run("pg_ctl", ["-D", pgData, "-l", `${pgData}/postgres.log`, "-o", `-p ${port}`, "-w", "start"]);
  }

  const databaseExists = execFileSync(
    "psql",
    ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${databaseName}'`],
    { encoding: "utf8" },
  ).trim();

  if (databaseExists !== "1") {
    run("createdb", ["-h", "127.0.0.1", "-p", port, "-U", "postgres", databaseName]);
  }
}

function stop() {
  if (isServerRunning()) {
    run("pg_ctl", ["-D", pgData, "-m", "fast", "stop"]);
  }
}

if (command === "start") {
  start();
} else if (command === "stop") {
  stop();
} else {
  throw new Error("Expected 'start' or 'stop'.");
}
