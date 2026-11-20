import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { readStoreProfiles, saveStoreProfiles } from "@/lib/store-profiles";

export async function GET(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  try { return NextResponse.json({ profiles: (await readStoreProfiles(db)).profiles }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Não foi possível carregar as lojas." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request); if (originError) return originError;
  const db = getServiceSupabase(); if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  try { return NextResponse.json({ ok: true, profiles: await saveStoreProfiles(db, (await request.json()).profiles) }); }
  catch { return NextResponse.json({ error: "Não foi possível salvar os endereços." }, { status: 500 }); }
}
