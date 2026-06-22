import "server-only";
import type { Escrow } from "@parcel/sdk";

// Server-side escrow store.
//
// PostgresRepo is used whenever DATABASE_URL is set (production). Otherwise a
// process-wide MemoryRepo keeps things runnable locally with zero setup. Both
// expose the same interface, so the API routes never branch on which is active.

export interface EscrowRepo {
  insert(e: Escrow): Promise<void>;
  get(id: string): Promise<Escrow | null>;
  update(e: Escrow): Promise<void>;
  list(owner?: string): Promise<Escrow[]>;
}

class MemoryRepo implements EscrowRepo {
  private store = new Map<string, Escrow>();

  async insert(e: Escrow) {
    this.store.set(e.id, e);
  }
  async get(id: string) {
    return this.store.get(id) ?? null;
  }
  async update(e: Escrow) {
    this.store.set(e.id, e);
  }
  async list(owner?: string) {
    return Array.from(this.store.values())
      .filter((e) => !owner || e.owner === owner)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

// Lazily import `pg` so the dependency is only loaded when a DB is configured.
class PostgresRepo implements EscrowRepo {
  private ready: Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any;

  constructor(connectionString: string) {
    this.ready = (async () => {
      const { Pool } = await import("pg");
      this.pool = new Pool({ connectionString });
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS escrows (
          id   TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          owner TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
    })();
  }

  async insert(e: Escrow) {
    await this.ready;
    await this.pool.query(
      "INSERT INTO escrows (id, data, owner, created_at) VALUES ($1, $2, $3, $4)",
      [e.id, e, e.owner, e.createdAt]
    );
  }
  async get(id: string) {
    await this.ready;
    const r = await this.pool.query("SELECT data FROM escrows WHERE id = $1", [id]);
    return r.rows[0]?.data ?? null;
  }
  async update(e: Escrow) {
    await this.ready;
    await this.pool.query("UPDATE escrows SET data = $2 WHERE id = $1", [e.id, e]);
  }
  async list(owner?: string) {
    await this.ready;
    const r = owner
      ? await this.pool.query(
          "SELECT data FROM escrows WHERE owner = $1 ORDER BY created_at DESC",
          [owner]
        )
      : await this.pool.query("SELECT data FROM escrows ORDER BY created_at DESC");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return r.rows.map((row: any) => row.data as Escrow);
  }
}

// Singleton across hot reloads in dev.
const globalForRepo = globalThis as unknown as { _parcelRepo?: EscrowRepo };

export function getRepo(): EscrowRepo {
  if (!globalForRepo._parcelRepo) {
    globalForRepo._parcelRepo = process.env.DATABASE_URL
      ? new PostgresRepo(process.env.DATABASE_URL)
      : new MemoryRepo();
  }
  return globalForRepo._parcelRepo;
}
