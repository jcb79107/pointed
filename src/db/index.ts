import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { scopedPool } from "./scoped-pool";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "@/db/schema";

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

const globalForDb = globalThis as unknown as {
  linearPokerPool?: Pool;
};

function getPool() {
  if (!globalForDb.linearPokerPool) {
    globalForDb.linearPokerPool = new Pool({
      // A loopback fallback keeps static builds and the setup screen usable
      // before deployment secrets are configured. No query is issued there.
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://pointline:pointline@127.0.0.1:5432/pointline",
    });
  }
  return globalForDb.linearPokerPool;
}

export const db = drizzle({ client: scopedPool(getPool(), async () => {
  const token = (await cookies()).get("lpp_session")?.value;
  return token ? createHash("sha256").update(token).digest("hex") : "";
}), schema });
