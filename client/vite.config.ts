import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function getBasePathFromAppUrl() {
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!appBaseUrl) {
    return "/";
  }

  try {
    const pathname = new URL(appBaseUrl).pathname;

    if (!pathname || pathname === "/") {
      return "/";
    }

    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  } catch {
    return "/";
  }
}

export default defineConfig({
  base: getBasePathFromAppUrl(),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
