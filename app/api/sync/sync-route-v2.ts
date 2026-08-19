import { NextResponse } from "next/server";
import { scrapeAll, type ScrapedProperty } from "@/lib/scraper";
import { query, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    await ensureSchema();
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `Error de base de datos: ${String(err?.message || err)}` },
      { status: 500 }
    );
  }

  const logRes = await query<{ id: number }>(`INSERT INTO sync_log (status) VALUES ('running') RETURNING id`);
  const logId = logRes[0].id;

  try {
    const properties = await scrapeAll();

    // Traemos el estado anterior de todas las propiedades EN UNA SOLA consulta
    // (en vez de una por propiedad) para que la sincronizacion sea rapida y no
    // se corte por el limite de tiempo de Vercel.
    const previous = await query<{ nai_id: number; precio_venta: string | null; precio_alquiler: string | null }>(
      `SELECT nai_id, precio_venta, precio_alquiler FROM properties`
    );
    const previousByCode = new Map(previous.map((row) => [row.nai_id, row]));

    const rows = properties.map((p: ScrapedProperty) => {
      const anterior = previousByCode.get(p.naiId);
      const seVendioAhora = !!(anterior && anterior.precio_venta !== null && p.precioVenta === null);
      const seAlquiloAhora = !!(anterior && anterior.precio_alquiler !== null && p.precioAlquiler === null);

      return {
        nai_id: p.naiId,
        titulo: p.titulo,
        ubicacion: p.ubicacion,
        agrupacion: p.agrupacion,
        tipo: p.tipo,
        fecha_ingreso: p.fechaIngreso,
        ult_movimiento: p.ultMovimiento,
        operacion: p.operacion,
        precio_venta: p.precioVenta,
        moneda_venta: p.monedaVenta,
        precio_alquiler: p.precioAlquiler,
        moneda_alquiler: p.monedaAlquiler,
        superficie: p.superficie,
        dormitorios: p.dormitorios,
        banos: p.banos,
        agente: p.agente,
        tags: p.tags || [],
        url: p.url,
        fecha_cierre_venta: seVendioAhora ? new Date().toISOString() : null,
        fecha_cierre_alquiler: seAlquiloAhora ? new Date().toISOString() : null,
      };
    });

    // Una sola consulta para guardar/actualizar TODAS las propiedades a la vez.
    // jsonb_to_recordset "desarma" el array que mandamos como un solo parametro
    // en filas de tabla, evitando tener que hacer una consulta por propiedad.
    if (rows.length) {
      await query(
        `INSERT INTO properties (
           nai_id, titulo, ubicacion, agrupacion, tipo, fecha_ingreso, ult_movimiento, operacion,
           precio_venta, moneda_venta, precio_alquiler, moneda_alquiler,
           superficie, dormitorios, banos, agente, tags, url, updated_at,
           fecha_cierre_venta, fecha_cierre_alquiler
         )
         SELECT
           r.nai_id, r.titulo, r.ubicacion, r.agrupacion, r.tipo, r.fecha_ingreso, r.ult_movimiento, r.operacion,
           r.precio_venta, r.moneda_venta, r.precio_alquiler, r.moneda_alquiler,
           r.superficie, r.dormitorios, r.banos, r.agente,
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(r.tags) x), ARRAY[]::text[]),
           r.url, now(), r.fecha_cierre_venta, r.fecha_cierre_alquiler
         FROM jsonb_to_recordset($1::jsonb) AS r(
           nai_id int, titulo text, ubicacion text, agrupacion text, tipo text,
           fecha_ingreso text, ult_movimiento text, operacion text,
           precio_venta numeric, moneda_venta text, precio_alquiler numeric, moneda_alquiler text,
           superficie numeric, dormitorios numeric, banos numeric, agente text, tags jsonb, url text,
           fecha_cierre_venta timestamptz, fecha_cierre_alquiler timestamptz
         )
         ON CONFLICT (nai_id) DO UPDATE SET
           titulo = EXCLUDED.titulo,
           ubicacion = EXCLUDED.ubicacion,
           agrupacion = EXCLUDED.agrupacion,
           tipo = EXCLUDED.tipo,
           fecha_ingreso = EXCLUDED.fecha_ingreso,
           ult_movimiento = EXCLUDED.ult_movimiento,
           operacion = EXCLUDED.operacion,
           precio_venta = EXCLUDED.precio_venta,
           moneda_venta = EXCLUDED.moneda_venta,
           precio_alquiler = EXCLUDED.precio_alquiler,
           moneda_alquiler = EXCLUDED.moneda_alquiler,
           superficie = EXCLUDED.superficie,
           dormitorios = EXCLUDED.dormitorios,
           banos = EXCLUDED.banos,
           agente = EXCLUDED.agente,
           tags = EXCLUDED.tags,
           url = EXCLUDED.url,
           updated_at = now(),
           fecha_cierre_venta = COALESCE(properties.fecha_cierre_venta, EXCLUDED.fecha_cierre_venta),
           fecha_cierre_alquiler = COALESCE(properties.fecha_cierre_alquiler, EXCLUDED.fecha_cierre_alquiler)
        `,
        [JSON.stringify(rows)]
      );

      // Historial: una sola consulta tambien, en vez de una insercion por propiedad.
      await query(
        `INSERT INTO properties_history (nai_id, operacion, tags, precio_venta, precio_alquiler)
         SELECT
           r.nai_id, r.operacion,
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(r.tags) x), ARRAY[]::text[]),
           r.precio_venta, r.precio_alquiler
         FROM jsonb_to_recordset($1::jsonb) AS r(
           nai_id int, operacion text, tags jsonb, precio_venta numeric, precio_alquiler numeric
         )`,
        [JSON.stringify(rows)]
      );
    }

    await query(`UPDATE sync_log SET finished_at = now(), status = 'ok', properties_count = $1 WHERE id = $2`, [
      properties.length,
      logId,
    ]);

    return NextResponse.json({ ok: true, count: properties.length });
  } catch (err: any) {
    const message = String(err?.message || err);
    await query(`UPDATE sync_log SET finished_at = now(), status = 'error', error = $1 WHERE id = $2`, [
      message,
      logId,
    ]);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query(`SELECT * FROM sync_log ORDER BY id DESC LIMIT 5`);
    return NextResponse.json({ history: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
