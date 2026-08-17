import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
  },
  resolve: {
    // Entspricht apps/web/tsconfig.json ("paths": { "@/*": ["./src/*"] }) — nur dort
    // genutzt (kein packages/*-Code importiert über "@/"), deshalb hier bewusst als
    // einzelner globaler Alias statt pro-Workspace-Konfiguration.
    alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) },
  },
});
