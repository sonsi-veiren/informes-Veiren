import { NextResponse } from "next/server";
import { login, fetchListingPage, parseListing } from "@/lib/scraper";
import { query, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnostico: loguea contra NAI, trae la pagina 1, y devuelve
 * un resumen de lo que efectivamente llego (sin tener que copiar el
 * codigo fuente a mano). Tambien compara contra lo que hay guardado en la
 * base de datos ahora mismo, para esos mismos IDs, asi se puede ver en que
 * paso se pierde la info. No expone la cookie ni las credenciales.
 */
export async function GET() {
  try {
    const cookie = await login();
    const html = await fetchListingPage(cookie, 1);

    const agrupacionMatches = [...html.matchAll(/agrupacion\.php\?i=\d+">([^<]+)</g)].map((m) => m[1]);
    const { properties } = parseListing(html);

    const idsConAgrupacion = properties.filter((p) => p.agrupacion).map((p) => p.naiId);

    let dbRows: any[] = [];
    let dbError: string | null = null;
    try {
      await ensureSchema();
      if (idsConAgrupacion.length) {
        dbRows = await query(
          `SELECT nai_id, titulo, agrupacion, superficie, updated_at FROM properties WHERE nai_id = ANY($1) ORDER BY nai_id`,
          [idsConAgrupacion]
        );
      }
    } catch (e: any) {
      dbError = String(e?.message || e);
    }

    return NextResponse.json({
      ok: true,
      htmlLength: html.length,
      containsAgrupacionPhp: html.includes("agrupacion.php"),
      agrupacionLinksFoundInRawHtml: agrupacionMatches,
      totalPropertiesParsed: properties.length,
      propertiesWithAgrupacion_segunNAI_ahora: properties
        .filter((p) => p.agrupacion)
        .map((p) => ({ id: p.naiId, titulo: p.titulo, agrupacion: p.agrupacion })),
      esosMismosIds_segunLaBaseDeDatos: dbRows,
      errorLeyendoLaBase: dbError,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
