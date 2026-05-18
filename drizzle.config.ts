import { defineConfig } from "drizzle-kit";
import { resolveAuthToken, resolveDatabaseUrl } from "./src/lib/db-config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: resolveDatabaseUrl(),
    authToken: resolveAuthToken(),
  },
});
