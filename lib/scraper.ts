import { NextResponse } from "next/server";
import { login, fetchListingPage, parseListing } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnostico: loguea contra NAI, trae la pagina 1, y devuelve
 * un resumen de lo que efectivamente llego (sin tener que copiar el
 * codigo fuente a mano). No expone la cookie ni las credenciales.
 */
export async function GET() {
  try {
    const cookie = await login();
    const html = await fetchListingPage(cookie, 1);

    const agrupacionMatches = [...html.matchAll(/agrupacion\.php\?i=\d+">([^<]+)</g)].map((m) => m[1]);
    const { properties } = parseListing(html);

    return NextResponse.json({
      ok: true,
      htmlLength: html.length,
      containsAgrupacionPhp: html.includes("agrupacion.php"),
      agrupacionLinksFoundInRawHtml: agrupacionMatches,
      totalPropertiesParsed: properties.length,
      propertiesWithAgrupacion: properties
        .filter((p) => p.agrupacion)
        .map((p) => ({ id: p.naiId, titulo: p.titulo, agrupacion: p.agrupacion })),
      firstFewParsed: properties.slice(0, 5).map((p) => ({
        id: p.naiId,
        titulo: p.titulo,
        ubicacion: p.ubicacion,
        agrupacion: p.agrupacion,
        superficie: p.superficie,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
