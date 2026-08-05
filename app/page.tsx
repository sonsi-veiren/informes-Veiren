"use client";

import { useEffect, useMemo, useState } from "react";
import { aggregateByCategoriaOperacion, aggregateByTipo, classifyCategoria, countByField } from "@/lib/kpis";
import { CountPieChart, GroupedCategoriaChart, TipoBarChart } from "./components/Charts";

interface Property {
  nai_id: number;
  titulo: string;
  ubicacion: string;
  agrupacion: string | null;
  tipo: string;
  fecha_ingreso: string | null;
  ult_movimiento: string | null;
  operacion: string | null;
  precio_venta: number | null;
  moneda_venta: string | null;
  precio_alquiler: number | null;
  moneda_alquiler: string | null;
  superficie: number | null;
  dormitorios: number | null;
  banos: number | null;
  agente: string | null;
  tags: string[] | null;
  url: string | null;
  inversion_mkt: number | null;
  clics: number | null;
  leads: number | null;
  comentarios: string | null;
}

type EditableField = "inversion_mkt" | "clics" | "leads" | "comentarios";

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return "-";
  const formatted = new Intl.NumberFormat("es-UY").format(amount);
  return `${currency || ""} ${formatted}`.trim();
}

export default function HomePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [passcode, setPasscode] = useState<string>("");
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  async function loadProperties() {
    const res = await fetch("/api/properties");
    const data = await res.json();
    if (data.properties) setProperties(data.properties);
  }

  async function runSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setSyncError(data.error || "Error desconocido al actualizar desde NAI");
      } else {
        setLastSync(new Date().toLocaleString("es-UY"));
      }
    } catch (err: any) {
      setSyncError(String(err?.message || err));
    } finally {
      setSyncing(false);
      await loadProperties();
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("veiren_edit_passcode");
    if (saved) setPasscode(saved);
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const total = properties.length;
    const byOperacion: Record<string, number> = {};
    const byTipo: Record<string, number> = {};
    const ventaUsd: number[] = [];
    const alquilerUsd: number[] = [];

    for (const p of properties) {
      if (p.operacion) byOperacion[p.operacion] = (byOperacion[p.operacion] || 0) + 1;
      if (p.tipo) byTipo[p.tipo] = (byTipo[p.tipo] || 0) + 1;
      if (p.precio_venta && p.moneda_venta === "USD") ventaUsd.push(Number(p.precio_venta));
      if (p.precio_alquiler && p.moneda_alquiler === "USD") alquilerUsd.push(Number(p.precio_alquiler));
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    return {
      total,
      byOperacion,
      byTipo,
      avgVentaUsd: avg(ventaUsd),
      avgAlquilerUsd: avg(alquilerUsd),
    };
  }, [properties]);

  const aggregatedByTipo = useMemo(() => aggregateByTipo(properties), [properties]);
  const operacionData = useMemo(() => countByField(properties, "operacion"), [properties]);
  const categoriaOperacionData = useMemo(() => aggregateByCategoriaOperacion(properties), [properties]);

  function startEdit(id: number, field: EditableField, currentValue: string | number | null) {
    setEditingCell({ id, field });
    setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
    setSaveError(null);
  }

  async function saveEdit() {
    if (!editingCell) return;
    if (!passcode) {
      setSaveError("Ingresá el código de edición primero.");
      return;
    }

    const body: Record<string, string> = { [editingCell.field]: editValue };
    const res = await fetch(`/api/properties/${editingCell.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-edit-passcode": passcode },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      setSaveError(data.error || "No se pudo guardar");
      return;
    }
    sessionStorage.setItem("veiren_edit_passcode", passcode);
    setEditingCell(null);
    await loadProperties();
  }

  return (
    <main style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logoFailed ? (
            <span
              style={{
                fontWeight: 700,
                fontSize: 26,
                color: "#002fa7",
                letterSpacing: 0.5,
                fontFamily: "inherit",
              }}
            >
              veiren
            </span>
          ) : (
            <img
              src="/veiren-logo.png"
              alt="Veiren"
              style={{ height: 42, width: "auto" }}
              onError={() => setLogoFailed(true)}
            />
          )}
          <div>
            <h1 style={{ fontFamily: "inherit", fontSize: 22, margin: 0, color: "#101827" }}>
              Informe de Propiedades
            </h1>
            <p style={{ margin: "4px 0 0", color: "#383b43", fontSize: 13 }}>
              Datos sincronizados desde NAI. Reemplaza el Excel mensual.
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <button
            onClick={runSync}
            disabled={syncing}
            style={{
              background: "#002fa7",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {syncing ? "Actualizando..." : "Actualizar desde NAI"}
          </button>
          {lastSync && <div style={{ fontSize: 11, color: "#383b43", marginTop: 4 }}>Última sync: {lastSync}</div>}
        </div>
      </header>

      {syncError && (
        <div
          style={{
            background: "#fdecec",
            border: "1px solid #f5b5b5",
            color: "#900",
            padding: "10px 14px",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          No se pudo actualizar desde NAI: {syncError}
          <br />
          Mostrando los últimos datos guardados en la base.
        </div>
      )}

      {/* KPIs */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <KpiCard label="Total propiedades" value={String(kpis.total)} />
        <KpiCard label="En venta" value={String(kpis.byOperacion["venta"] || 0)} />
        <KpiCard label="En alquiler" value={String(kpis.byOperacion["alquiler"] || 0)} />
        <KpiCard
          label="Precio venta prom. (USD)"
          value={kpis.avgVentaUsd ? formatMoney(Math.round(kpis.avgVentaUsd), "USD") : "-"}
        />
        <KpiCard
          label="Precio alquiler prom. (USD)"
          value={kpis.avgAlquilerUsd ? formatMoney(Math.round(kpis.avgAlquilerUsd), "USD") : "-"}
        />
      </section>

      {/* Gráficas */}
      <h2 style={{ fontSize: 15, color: "#101827", margin: "0 0 10px" }}>Dashboard</h2>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <TipoBarChart data={aggregatedByTipo} dataKey="cantidad" label="Cantidad de propiedades por tipo" />
        <CountPieChart data={operacionData} label="Distribución por operación" />
        <TipoBarChart
          data={aggregatedByTipo}
          dataKey="precioVentaProm"
          label="Precio venta promedio por tipo (USD)"
          valueFormatter={(v) => `USD ${new Intl.NumberFormat("es-UY").format(v)}`}
        />
        <TipoBarChart
          data={aggregatedByTipo}
          dataKey="precioAlquilerProm"
          label="Precio alquiler promedio por tipo (USD)"
          valueFormatter={(v) => `USD ${new Intl.NumberFormat("es-UY").format(v)}`}
        />
        <TipoBarChart
          data={aggregatedByTipo}
          dataKey="precioM2VentaProm"
          label="$/m² promedio en venta, por tipo (USD)"
          valueFormatter={(v) => `USD ${new Intl.NumberFormat("es-UY").format(v)}/m²`}
        />
        <TipoBarChart
          data={aggregatedByTipo}
          dataKey="mesesPublicadaProm"
          label="Meses promedio publicada, por tipo"
          valueFormatter={(v) => `${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 }).format(v)} meses`}
        />
        <GroupedCategoriaChart
          data={categoriaOperacionData}
          label="General vs DDC vs Externo — por operación"
        />
      </section>

      {/* Código de edición */}
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        Código de edición:{" "}
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Código"
          className="editable-input"
          style={{ width: 140 }}
        />{" "}
        <span style={{ color: "#383b43" }}>
          (hace falta para editar inversión en marketing, clics, leads y comentarios)
        </span>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #d9d9d9", borderRadius: 6 }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Ubicación</th>
                <th>Categoría</th>
                <th>Tipo</th>
                <th>Operación</th>
                <th>Venta</th>
                <th>Alquiler</th>
                <th>m²</th>
                <th>Dorm</th>
                <th>Baños</th>
                <th>Agente</th>
                <th>Últ. movimiento</th>
                <th>Tags</th>
                <th>Inversión mkt</th>
                <th>Clics</th>
                <th>Leads</th>
                <th>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.nai_id}>
                  <td>{p.nai_id}</td>
                  <td>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        {p.titulo}
                      </a>
                    ) : (
                      p.titulo
                    )}
                  </td>
                  <td>{p.ubicacion}</td>
                  <td>
                    <CategoriaBadge agrupacion={p.agrupacion} />
                  </td>
                  <td>{p.tipo}</td>
                  <td>{p.operacion}</td>
                  <td>{formatMoney(p.precio_venta, p.moneda_venta)}</td>
                  <td>{formatMoney(p.precio_alquiler, p.moneda_alquiler)}</td>
                  <td>{p.superficie ?? "-"}</td>
                  <td>{p.dormitorios ?? "-"}</td>
                  <td>{p.banos ?? "-"}</td>
                  <td>{p.agente ?? "-"}</td>
                  <td>{p.ult_movimiento ?? "-"}</td>
                  <td>{(p.tags || []).join(", ")}</td>

                  <EditableCell
                    property={p}
                    field="inversion_mkt"
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    startEdit={startEdit}
                    saveEdit={saveEdit}
                    saveError={saveError}
                  />
                  <EditableCell
                    property={p}
                    field="clics"
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    startEdit={startEdit}
                    saveEdit={saveEdit}
                    saveError={saveError}
                  />
                  <EditableCell
                    property={p}
                    field="leads"
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    startEdit={startEdit}
                    saveEdit={saveEdit}
                    saveError={saveError}
                  />
                  <EditableCell
                    property={p}
                    field="comentarios"
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    startEdit={startEdit}
                    saveEdit={saveEdit}
                    saveError={saveError}
                    wide
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function CategoriaBadge({ agrupacion }: { agrupacion: string | null }) {
  const categoria = classifyCategoria(agrupacion);
  const colors: Record<string, { bg: string; fg: string }> = {
    DDC: { bg: "#dbe6fb", fg: "#002fa7" },
    Extra: { bg: "#e6e7ea", fg: "#101827" },
    General: { bg: "#f4f4f4", fg: "#8891a5" },
  };
  const { bg, fg } = colors[categoria];
  return (
    <span
      title={agrupacion || undefined}
      style={{
        background: bg,
        color: fg,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {categoria}
      {agrupacion ? ` · ${agrupacion}` : ""}
    </span>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "white", borderRadius: 8, padding: "14px 16px", border: "1px solid #d9d9d9" }}>
      <div style={{ fontSize: 12, color: "#383b43" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#101827" }}>{value}</div>
    </div>
  );
}

function EditableCell({
  property,
  field,
  editingCell,
  editValue,
  setEditValue,
  startEdit,
  saveEdit,
  saveError,
  wide,
}: {
  property: Property;
  field: EditableField;
  editingCell: { id: number; field: EditableField } | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEdit: (id: number, field: EditableField, currentValue: string | number | null) => void;
  saveEdit: () => void;
  saveError: string | null;
  wide?: boolean;
}) {
  const isEditing = editingCell?.id === property.nai_id && editingCell?.field === field;
  const currentValue = property[field];

  if (isEditing) {
    return (
      <td>
        <input
          className="editable-input"
          style={wide ? { width: 200 } : undefined}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
          }}
        />
        <button onClick={saveEdit} style={{ marginLeft: 4, fontSize: 12 }}>
          OK
        </button>
        {saveError && <div style={{ color: "red", fontSize: 11 }}>{saveError}</div>}
      </td>
    );
  }

  return (
    <td onClick={() => startEdit(property.nai_id, field, currentValue)} style={{ cursor: "pointer" }} title="Click para editar">
      {currentValue === null || currentValue === undefined || currentValue === "" ? (
        <span style={{ color: "#bbb" }}>—</span>
      ) : (
        String(currentValue)
      )}
    </td>
  );
}
