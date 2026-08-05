export interface PropertyLike {
  tipo: string | null;
  operacion: string | null;
  agente: string | null;
  agrupacion: string | null;
  fecha_ingreso: string | null;
  precio_venta: number | null;
  moneda_venta: string | null;
  precio_alquiler: number | null;
  moneda_alquiler: string | null;
  superficie: number | null;
}

const MESES: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * NAI muestra las fechas de dos formas distintas segun que tan vieja sea:
 * "31 de jul" (sin anio, para fechas recientes) o "23/12/2025" (con anio,
 * para fechas mas viejas). Esta funcion soporta ambas.
 */
export function parseNaiDate(text: string | null | undefined): Date | null {
  if (!text) return null;
  const t = text.trim();

  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = t.match(/(\d{1,2})\s+de\s+([a-zA-Z\u00c0-\u00fc]+)/);
  if (m) {
    const day = Number(m[1]);
    const key = stripAccents(m[2].toLowerCase()).slice(0, 3);
    const monthIdx = MESES[key];
    if (monthIdx === undefined) return null;

    const now = new Date();
    let candidate = new Date(now.getFullYear(), monthIdx, day);
    // Si la fecha "sin anio" cae en el futuro, es porque en realidad es del anio pasado
    if (candidate.getTime() > now.getTime() + 24 * 3600 * 1000) {
      candidate = new Date(now.getFullYear() - 1, monthIdx, day);
    }
    return candidate;
  }

  return null;
}

export function monthsSince(date: Date, ref: Date = new Date()): number {
  const months = (ref.getFullYear() - date.getFullYear()) * 12 + (ref.getMonth() - date.getMonth());
  const dayAdjust = (ref.getDate() - date.getDate()) / 30;
  return Math.max(0, months + dayAdjust);
}

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

export interface AggregatedRow {
  tipo: string;
  cantidad: number;
  precioVentaProm: number | null;
  precioAlquilerProm: number | null;
  m2VentaProm: number | null;
  precioM2VentaProm: number | null;
  mesesPublicadaProm: number | null;
}

export function aggregateByTipo(properties: PropertyLike[]): AggregatedRow[] {
  const groups = new Map<string, PropertyLike[]>();
  for (const p of properties) {
    const tipo = p.tipo || "Sin tipo";
    if (!groups.has(tipo)) groups.set(tipo, []);
    groups.get(tipo)!.push(p);
  }

  const rows: AggregatedRow[] = [];
  for (const [tipo, items] of groups) {
    const ventaUsd = items
      .filter((i) => i.precio_venta && i.moneda_venta === "USD")
      .map((i) => Number(i.precio_venta));
    const alquilerUsd = items
      .filter((i) => i.precio_alquiler && i.moneda_alquiler === "USD")
      .map((i) => Number(i.precio_alquiler));
    const m2sVenta = items.filter((i) => i.precio_venta && i.superficie).map((i) => Number(i.superficie));
    const precioM2Venta = items
      .filter((i) => i.precio_venta && i.moneda_venta === "USD" && i.superficie && Number(i.superficie) > 0)
      .map((i) => Number(i.precio_venta) / Number(i.superficie));
    const meses = items
      .map((i) => parseNaiDate(i.fecha_ingreso))
      .filter((d): d is Date => d !== null)
      .map((d) => monthsSince(d));

    rows.push({
      tipo,
      cantidad: items.length,
      precioVentaProm: avg(ventaUsd),
      precioAlquilerProm: avg(alquilerUsd),
      m2VentaProm: avg(m2sVenta),
      precioM2VentaProm: avg(precioM2Venta),
      mesesPublicadaProm: avg(meses),
    });
  }

  return rows.sort((a, b) => b.cantidad - a.cantidad);
}

export function countByField(
  properties: PropertyLike[],
  field: "operacion" | "agente"
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const p of properties) {
    const raw = p[field];
    const key = raw && raw.trim() ? raw : "Sin dato";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Palabras clave de proyectos DDC (catalogo de proyectos, agosto 2026), en
 * minusculas y sin acentos, para comparar contra el nombre de "agrupacion"
 * que trae cada propiedad desde NAI (ej: "WELL 1", "Lagos Oeste", "LIV Aura").
 * Si una propiedad tiene agrupacion pero no matchea ninguna de estas, se
 * considera "Externo" (un desarrollo de otra inmobiliaria/desarrollador).
 * Si no tiene agrupacion, es una propiedad "General" (venta o alquiler suelto,
 * no parte de ningun complejo).
 */
const DDC_KEYWORDS = [
  "la reserva",
  "well",
  "la bahia",
  "liv",
  "las casas",
  "lagos",
  "campos",
  "eria",
  "bocking",
  "caleta",
  "jose ignacio",
  "horneros",
  "fresh plaza",
  "tierra",
];

export type Categoria = "General" | "DDC" | "Extra";

export function classifyCategoria(agrupacion: string | null | undefined): Categoria {
  if (!agrupacion || !agrupacion.trim() || agrupacion.trim().toLowerCase() === "x") return "General";
  const norm = stripAccents(agrupacion.toLowerCase());
  return DDC_KEYWORDS.some((k) => norm.includes(k)) ? "DDC" : "Extra";
}

export interface CategoriaOperacionRow {
  operacion: string;
  General: number;
  DDC: number;
  Extra: number;
}

export function aggregateByCategoriaOperacion(properties: PropertyLike[]): CategoriaOperacionRow[] {
  const venta: CategoriaOperacionRow = { operacion: "Venta", General: 0, DDC: 0, Extra: 0 };
  const alquiler: CategoriaOperacionRow = { operacion: "Alquiler", General: 0, DDC: 0, Extra: 0 };

  for (const p of properties) {
    const cat = classifyCategoria(p.agrupacion);
    if (p.precio_venta) venta[cat] += 1;
    if (p.precio_alquiler) alquiler[cat] += 1;
  }

  return [venta, alquiler];
}
