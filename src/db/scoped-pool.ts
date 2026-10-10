import { Pool, type PoolClient, type QueryConfig } from "@neondatabase/serverless";

type QueryInput = string | QueryConfig;

/** Transaction-local session identity: never carry a request's identity into
 * the next pooled connection. Drizzle uses query() for single statements and
 * connect()/BEGIN for explicit transactions, so both paths are covered. */
export function scopedPool(pool: Pool, sessionHash: () => Promise<string>): Pool {
  async function acquire() {
    const client = await pool.connect();
    try {
      const { rows } = await client.query("select current_user as name, rolbypassrls, rolsuper from pg_roles where rolname = current_user");
      if (rows[0]?.name !== "pointed_runtime" || rows[0]?.rolbypassrls || rows[0]?.rolsuper) {
        throw new Error("Database runtime role must be pointed_runtime without RLS bypass");
      }
      return client;
    } catch (error) { client.release(); throw error; }
  }
  async function identify(client: PoolClient, hash: string) {
    await client.query("select set_config('pointed.session_hash', $1, true)", [hash]);
  }
  return new Proxy(pool, {
    get(target, key) {
      if (key === "query") return async (query: QueryInput, values?: unknown[]) => {
        const hash = await sessionHash();
        const client = await acquire();
        let broken = false;
        try {
          await client.query("begin");
          await identify(client, hash);
          const result = await client.query(query, values);
          await client.query("commit");
          return result;
        } catch (error) {
          try { await client.query("rollback"); } catch { broken = true; }
          throw error;
        } finally { client.release(broken); }
      };
      if (key === "connect") return async () => {
        const hash = await sessionHash();
        const client = await acquire();
        return new Proxy(client, {
          get(connection, property) {
            if (property === "query") return async (query: QueryInput, values?: unknown[]) => {
              const begins = /^\s*begin\b/i.test(typeof query === "string" ? query : query.text);
              if (!begins) return connection.query(query, values);
              // Drizzle issues BEGIN before its transaction try/finally. Own
              // cleanup here if either BEGIN or identity setup fails.
              try {
                const result = await connection.query(query, values);
                await identify(connection, hash);
                return result;
              } catch (error) {
                let broken = false;
                try { await connection.query("rollback"); } catch { broken = true; }
                connection.release(broken);
                throw error;
              }
            };
            const value = Reflect.get(connection, property);
            return typeof value === "function" ? value.bind(connection) : value;
          },
        });
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
