import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/helpers/server-only.ts",
      ),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
      {
        test: {
          name: "integration",
          include: [
            "tests/integration/**/*.test.{ts,tsx}",
            "tests/rls/**/*.test.{ts,tsx}",
          ],
          environment: "node",
        },
      },
      {
        test: {
          name: "security",
          include: ["tests/security/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
