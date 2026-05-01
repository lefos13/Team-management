const path = require("node:path");
const dotenv = require("dotenv");

/*
Load the production env file while PM2 evaluates the ecosystem file so the app
always receives the same runtime values that deploy.sh validated.
*/
const envFile = process.env.ENV_FILE || path.resolve(__dirname, "../../server/.env.production");
dotenv.config({
  path: envFile,
  override: false,
});

/*
Run the built Fastify server under PM2 with one environment source so deploys,
reloads, and PM2 restarts do not keep stale localhost defaults.
*/
module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "team-management",
      cwd: process.env.APP_DIR || process.cwd(),
      script: "server/dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env_file: envFile,
      env: {
        ...process.env,
        NODE_ENV: "production",
        ENV_FILE: envFile,
      },
    },
  ],
};
