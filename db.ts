import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("Falta la variable de entorno DATABASE_URL");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const p = getPool();
  const res = await p.query<T>(text, params);
  return res.rows;
}

export async function ensureSchema(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS properties (
      nai_id INTEGER PRIMARY KEY,
      titulo TEXT,
      ubicacion TEXT,
      tipo TEXT,
      fecha_ingreso TEXT,
      ult_movimiento TEXT,
      operacion TEXT,
      precio_venta NUMERIC,
      moneda_venta TEXT,
      precio_alquiler NUMERIC,
      moneda_alquiler TEXT,
      superficie NUMERIC,
      dormitorios NUMERIC,
      banos NUMERIC,
      agente TEXT,
      tags TEXT[],
      url TEXT,
      inversion_mkt NUMERIC,
      clics NUMERIC,
      leads NUMERIC,
      comentarios TEXT,
      updated_at TIMESTAMPTZ DEFAULT now(),
      manual_updated_at TIMESTAMPTZ
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ DEFAULT now(),
      finished_at TIMESTAMPTZ,
      properties_count INTEGER,
      status TEXT,
      error TEXT
    );
  `);
}
