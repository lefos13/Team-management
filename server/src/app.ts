/* Compose the API around shared validation, cookie sessions, route modules, and the built client so one production process can serve the whole app. */
import "dotenv/config";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
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
  const appBasePathname = new URL(config.APP_BASE_URL).pathname;
  const basePath = appBasePathname === "/" ? "/" : appBasePathname.replace(/\/+$/, "");
  const routeWithBase = (path: string) => (basePath === "/" ? path : `${basePath}${path}`);
  const apiPrefix = routeWithBase("/api");
  const staticPrefix = basePath === "/" ? "/" : `${basePath}/`;
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
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 5 * 1024 * 1024,
    },
  });
  await app.register(authPlugin);

  app.get(routeWithBase("/api/health"), async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: apiPrefix });
  await app.register(projectRoutes, { prefix: apiPrefix });
  await app.register(memberRoutes, { prefix: apiPrefix });
  await app.register(taskRoutes, { prefix: apiPrefix });
  await app.register(dashboardRoutes, { prefix: apiPrefix });

  /*
  Register the built SPA only when the client bundle exists so local API development
  keeps working without a production build, while PM2 can serve both layers on one port.
  */
  if (hasClientBuild) {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: staticPrefix,
      wildcard: false,
      index: false,
    });

    app.get(basePath, async (_request, reply) => {
      await reply.sendFile("index.html");
    });

    if (basePath !== "/") {
      app.get(`${basePath}/`, async (_request, reply) => {
        await reply.sendFile("index.html");
      });
    }

    app.get(routeWithBase("/*"), async (request, reply) => {
      if (request.url.startsWith(apiPrefix)) {
        return reply.callNotFound();
      }

      await reply.sendFile("index.html");
    });
  }

  return app;
}
