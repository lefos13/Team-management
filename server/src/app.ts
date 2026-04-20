/* Compose the API around shared validation, cookie sessions, route modules, and the built client so one production process can serve the whole app. */
import "dotenv/config";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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
  const clientDistPath = resolve(process.cwd(), "client/dist");
  const hasClientBuild = existsSync(clientDistPath);
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

  /*
  Register the built SPA only when the client bundle exists so local API development
  keeps working without a production build, while PM2 can serve both layers on one port.
  */
  if (hasClientBuild) {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: "/",
      wildcard: false,
      index: false,
    });

    app.get("/", async (_request, reply) => {
      await reply.sendFile("index.html");
    });

    app.get("/*", async (request, reply) => {
      if (request.url.startsWith("/api")) {
        return reply.callNotFound();
      }

      await reply.sendFile("index.html");
    });
  }

  return app;
}
