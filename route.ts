import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const passcode = req.headers.get("x-edit-passcode");
  if (!process.env.EDIT_PASSCODE || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ ok: false, error: "Código incorrecto" }, { status: 401 });
  }

  const body = await req.json();
  const inversionMkt = body.inversion_mkt === "" || body.inversion_mkt === undefined ? null : Number(body.inversion_mkt);
  const clics = body.clics === "" || body.clics === undefined ? null : Number(body.clics);
  const leads = body.leads === "" || body.leads === undefined ? null : Number(body.leads);
  const comentarios = body.comentarios === undefined ? null : String(body.comentarios);

  try {
    await query(
      `UPDATE properties SET
         inversion_mkt = COALESCE($1, inversion_mkt),
         clics = COALESCE($2, clics),
         leads = COALESCE($3, leads),
         comentarios = COALESCE($4, comentarios),
         manual_updated_at = now()
       WHERE nai_id = $5`,
      [inversionMkt, clics, leads, comentarios, params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
