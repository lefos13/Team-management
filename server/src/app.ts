/* Compose the API around shared validation, cookie sessions, and route modules so all accounts use one consistent runtime. */
import "dotenv/config";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";

import { getConfig } from "./config.js";
import { registerErrorHandler } from "./lib/errors.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { memberRoutes } from "./routes/members.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";

export async function createApp() {
  const config = getConfig();
  const app = Fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(registerErrorHandler());

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });
  await app.register(cors, {
    origin: config.CLIENT_ORIGIN,
    credentials: true,
  });
  await app.register(authPlugin);

  app.get("/api/health", async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(projectRoutes, { prefix: "/api" });
  await app.register(memberRoutes, { prefix: "/api" });
  await app.register(taskRoutes, { prefix: "/api" });
  await app.register(dashboardRoutes, { prefix: "/api" });

  return app;
}
