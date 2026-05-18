import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { resolveAuthToken, resolveDatabaseUrl } from "@/lib/db-config";
import * as schema from "./schema";

const client = createClient({
  url: resolveDatabaseUrl(),
  authToken: resolveAuthToken(),
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
