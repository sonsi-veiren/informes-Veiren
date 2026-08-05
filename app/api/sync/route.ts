import { NextResponse } from "next/server";
import { scrapeAll } from "@/lib/scraper";
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

    for (const p of properties) {
      await query(
        `INSERT INTO properties (
          nai_id, titulo, ubicacion, agrupacion, tipo, fecha_ingreso, ult_movimiento, operacion,
          precio_venta, moneda_venta, precio_alquiler, moneda_alquiler,
          superficie, dormitorios, banos, agente, tags, url, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
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
          updated_at = now()
        `,
        [
          p.naiId,
          p.titulo,
          p.ubicacion,
          p.agrupacion,
          p.tipo,
          p.fechaIngreso,
          p.ultMovimiento,
          p.operacion,
          p.precioVenta,
          p.monedaVenta,
          p.precioAlquiler,
          p.monedaAlquiler,
          p.superficie,
          p.dormitorios,
          p.banos,
          p.agente,
          p.tags,
          p.url,
        ]
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
