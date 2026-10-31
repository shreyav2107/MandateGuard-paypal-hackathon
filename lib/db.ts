import * as dns from "node:dns";
import { Pool } from "pg";

let poolPromise: Promise<Pool> | null = null;

export function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPool().catch((error: unknown) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

async function createPool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const url = new URL(connectionString);
  const hostname = url.hostname;
  const resolver = new dns.promises.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);

  const addresses = await resolver.resolve4(hostname);
  const host = addresses[0];

  if (!host) {
    throw new Error("DATABASE_URL hostname did not resolve to an IPv4 address");
  }

  return new Pool({
    host,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    port: url.port ? Number(url.port) : 5432,
    ssl: { servername: hostname },
  });
}
