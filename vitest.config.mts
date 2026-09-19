import react from "@vitejs/plugin-react";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_BILLING_ENV } from "./tests/setup/billing-env.mjs";

loadEnv({ quiet: true });
// Workers inherit this process's environment: no project may see a real Paddle key.
Object.assign(process.env, TEST_BILLING_ENV);

const emptyModule = fileURLToPath(new URL("./tests/setup/empty-module.ts", import.meta.url));

// `server-only` throws outside the React Server environment; tests run plain Node.
const alias = { "server-only": emptyModule };

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        resolve: { alias },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["tests/setup/components.ts"],
        },
      },
      {
        extends: true,
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          // Providers are pinned explicitly: `.env` is loaded above, so real keys must never be used.
          env: {
            DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
            EMAIL_TRANSPORT: "capture",
            ...TEST_BILLING_ENV,
          },
          globalSetup: ["tests/setup/integration-global-setup.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          // Tests share one database, so files must not run concurrently.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
