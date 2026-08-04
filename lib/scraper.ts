import * as cheerio from "cheerio";

const BASE = "https://app.nai.com.uy";

export interface ScrapedProperty {
  naiId: number;
  titulo: string;
  ubicacion: string;
  tipo: string;
  fechaIngreso: string | null;
  ultMovimiento: string | null;
  operacion: "venta" | "alquiler" | "venta_alquiler" | null;
  precioVenta: number | null;
  monedaVenta: string | null;
  precioAlquiler: number | null;
  monedaAlquiler: string | null;
  superficie: number | null;
  dormitorios: number | null;
  banos: number | null;
  agente: string | null;
  tags: string[];
  url: string;
}

function parsePrice(text: string): { amount: number | null; currency: string | null } {
  const t = (text || "").trim();
  if (!t) return { amount: null, currency: null };
  const m = t.match(/(USD|UYU|\$U|\$)\s*([\d.,]+)/i);
  if (!m) return { amount: null, currency: null };
  let currency = m[1].toUpperCase();
  if (currency === "$U" || currency === "$") currency = "UYU";
  const amount = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
  return { amount: isNaN(amount) ? null : amount, currency };
}

function parseNumber(text: string): number | null {
  const withoutUnits = (text || "").replace(/[a-zA-Záéíóúñ]+/g, " ");
  const t = withoutUnits.replace(/[^\d.,]/g, "").trim();
  if (!t) return null;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

/**
 * Loguea contra NAI usando las credenciales de las variables de entorno
 * y devuelve el header Cookie a usar en los siguientes pedidos.
 *
 * NOTA: esta función depende de que NAI mantenga el mismo formulario de login
 * (campos "usuario" y "clave", cmd=login). Si NAI cambia el login, esto se rompe
 * con un error claro ("no devolvio cookie de sesion").
 */
export async function login(): Promise<string> {
  const usuario = process.env.NAI_USER;
  const clave = process.env.NAI_PASSWORD;
  if (!usuario || !clave) {
    throw new Error("Faltan las variables de entorno NAI_USER / NAI_PASSWORD");
  }

  const body = new URLSearchParams({ cmd: "login", usuario, clave });
  const res = await fetch(`${BASE}/login.php`, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  // En runtimes modernos (undici / Vercel) hay getSetCookie() para multiples cookies.
  // Si no existe, caemos a un unico header set-cookie.
  const headersAny = res.headers as unknown as { getSetCookie?: () => string[] };
  const cookies: string[] = headersAny.getSetCookie
    ? headersAny.getSetCookie()
    : res.headers.get("set-cookie")
    ? [res.headers.get("set-cookie") as string]
    : [];

  if (!cookies.length) {
    throw new Error(
      "NAI no devolvio ninguna cookie de sesion al intentar loguear. Revisa NAI_USER / NAI_PASSWORD, o puede que NAI haya cambiado el formulario de login."
    );
  }

  return cookies.map((c) => c.split(";")[0]).join("; ");
}

export async function fetchListingPage(cookie: string, page: number): Promise<string> {
  const url = `${BASE}/propiedades.php?e=1&p=${page}`;
  const res = await fetch(url, { headers: { Cookie: cookie } });
  if (!res.ok) {
    throw new Error(`Error al pedir propiedades.php (pagina ${page}): HTTP ${res.status}`);
  }
  const html = await res.text();
  // Si NAI redirige al login, el html va a tener el formulario de login en vez del listado.
  if (html.includes('id="usuario"') && html.includes('id="clave"')) {
    throw new Error("NAI devolvio la pantalla de login en vez del listado: la sesion no quedo autenticada.");
  }
  return html;
}

export function parseListing(html: string): { properties: ScrapedProperty[]; totalPages: number } {
  const $ = cheerio.load(html);
  const properties: ScrapedProperty[] = [];

  $(".listado_entrada.listado_entrada_propiedad").each((_, el) => {
    const row = $(el);

    const link = row.find(".titulo_listado a").first();
    const href = link.attr("href") || "";
    const idMatch = href.match(/i=(\d+)/);
    if (!idMatch) return;
    const naiId = parseInt(idMatch[1], 10);
    const titulo = link.text().trim();

    const datosCols = row.find("> .propiedades_listado_columna_datos > .dato_listado");
    const ubicacion = datosCols.eq(0).text().replace(/\s+/g, " ").trim();
    const tipo = datosCols.eq(1).find("strong").text().trim();

    let fechaIngreso: string | null = null;
    let ultMovimiento: string | null = null;
    row.find(".solo_desktop > .dato_listado.sub_sub_texto").each((_i, d) => {
      const text = $(d).text().replace(/\s+/g, " ").trim();
      if (text.startsWith("fecha ingreso:")) {
        fechaIngreso = text.replace("fecha ingreso:", "").trim();
      } else if (text.includes("últ. movimiento:")) {
        ultMovimiento = text.split("últ. movimiento:").pop()!.trim();
      }
    });

    const col4 = row.find("> .propiedades_listado_columna_4 > .dato_listado");
    const col5 = row.find("> .propiedades_listado_columna_5 > .dato_listado");

    const ventaValueText = col5.eq(0).text().trim();
    const alquilerValueText = col5.eq(1).text().trim();

    const venta = parsePrice(ventaValueText);
    const alquiler = parsePrice(alquilerValueText);

    let operacion: ScrapedProperty["operacion"] = null;
    if (venta.amount && alquiler.amount) operacion = "venta_alquiler";
    else if (venta.amount) operacion = "venta";
    else if (alquiler.amount) operacion = "alquiler";

    const superficieText = col5.eq(2).text();
    const dormitoriosText = col5.eq(3).text();
    const banosText = col5.eq(4).text();

    const agenteText = row.find(".propiedades_listado_columna_6 .dato_listado a").first().text().trim();

    const tags: string[] = [];
    row.find(".contenedor_tags > .p_tag").each((_i, t) => {
      const tag = $(t);
      const txt = tag.clone().children().remove().end().text().trim();
      if (txt) tags.push(txt);
    });

    properties.push({
      naiId,
      titulo,
      ubicacion,
      tipo,
      fechaIngreso,
      ultMovimiento,
      operacion,
      precioVenta: venta.amount,
      monedaVenta: venta.currency,
      precioAlquiler: alquiler.amount,
      monedaAlquiler: alquiler.currency,
      superficie: parseNumber(superficieText),
      dormitorios: parseNumber(dormitoriosText),
      banos: parseNumber(banosText),
      agente: agenteText || null,
      tags,
      url: `${BASE}/propiedad.php?i=${naiId}`,
    });
  });

  let totalPages = 1;
  const pagText = $("#paginas_pie").text();
  const pm = pagText.match(/(\d+)/);
  if (pm) totalPages = parseInt(pm[1], 10);

  return { properties, totalPages };
}

export async function scrapeAll(): Promise<ScrapedProperty[]> {
  const cookie = await login();
  const first = await fetchListingPage(cookie, 1);
  const { properties, totalPages } = parseListing(first);
  const all = [...properties];

  for (let p = 2; p <= totalPages; p++) {
    const html = await fetchListingPage(cookie, p);
    const { properties: pageProps } = parseListing(html);
    all.push(...pageProps);
  }

  return all;
}
