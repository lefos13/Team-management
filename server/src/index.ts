/* Start the shared Fastify app with graceful shutdown so local development and tests behave the same way. */
import { prisma } from "./db.js";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";

async function main() {
  const config = getConfig();
  const app = await createApp();

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({
    host: "0.0.0.0",
    port: config.PORT,
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
