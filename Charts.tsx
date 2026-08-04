"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AggregatedRow } from "@/lib/kpis";

const COLORS = ["#002fa7", "#4c6794", "#7a94c4", "#a9bce0", "#101827", "#383b43", "#8891a5"];

function ChartCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #d9d9d9", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#101827" }}>{label}</div>
      {children}
    </div>
  );
}

export function TipoBarChart({
  data,
  dataKey,
  label,
  valueFormatter,
}: {
  data: AggregatedRow[];
  dataKey: keyof AggregatedRow;
  label: string;
  valueFormatter?: (v: number) => string;
}) {
  const chartData = data
    .filter((d) => d[dataKey] !== null && d[dataKey] !== undefined)
    .map((d) => ({ tipo: d.tipo, valor: Math.round(Number(d[dataKey]) * 100) / 100 }));

  if (!chartData.length) {
    return (
      <ChartCard label={label}>
        <EmptyState />
      </ChartCard>
    );
  }

  return (
    <ChartCard label={label}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="tipo" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v: number) => (valueFormatter ? valueFormatter(v) : String(v))} />
          <Bar dataKey="valor" fill="#002fa7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CountPieChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  if (!data.length) {
    return (
      <ChartCard label={label}>
        <EmptyState />
      </ChartCard>
    );
  }

  return (
    <ChartCard label={label}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={75}
            label={(entry) => `${entry.name} (${entry.value})`}
            labelLine={false}
            fontSize={11}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CountBarChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  if (!data.length) {
    return (
      <ChartCard label={label}>
        <EmptyState />
      </ChartCard>
    );
  }

  return (
    <ChartCard label={label}>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis type="number" fontSize={11} allowDecimals={false} />
          <YAxis type="category" dataKey="name" fontSize={11} width={110} />
          <Tooltip />
          <Bar dataKey="value" fill="#002fa7" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function EmptyState() {
  return <div style={{ fontSize: 12, color: "#8891a5", padding: "40px 0", textAlign: "center" }}>Sin datos suficientes todavía</div>;
}
