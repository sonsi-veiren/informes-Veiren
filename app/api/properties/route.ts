import { NextResponse } from "next/server";
import { query, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query(`SELECT * FROM properties ORDER BY nai_id DESC`);
    return NextResponse.json({ properties: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
