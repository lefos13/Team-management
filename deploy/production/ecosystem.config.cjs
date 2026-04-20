/*
Run the built Fastify server under PM2 with one environment file so deploys and restarts use the same runtime config.
*/
module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "team-management",
      cwd: process.env.APP_DIR || process.cwd(),
      script: "server/dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env_file: process.env.ENV_FILE || "server/.env.production",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
