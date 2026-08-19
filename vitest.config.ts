import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts", "apps/home4effinder/src/**/*.test.ts"],
  },
});
