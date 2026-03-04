import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getProjectRefFromUrl(url?: string) {
  const raw = String(url || "").trim();
  const match = raw.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] || null;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const projectRef = getProjectRefFromUrl(supabaseUrl);

  const result: Record<string, unknown> = {
    env: {
      has_url: Boolean(supabaseUrl),
      has_anon: Boolean(anonKey),
      has_service: Boolean(serviceKey),
      project_ref: projectRef,
    },
  };

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        ...result,
        error: "NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes.",
      },
      { status: 500 },
    );
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { error: anonError, count: anonCount } = await anon
    .from("estoque")
    .select("id", { head: true, count: "exact" });

  result.anon_select_estoque = {
    ok: !anonError,
    count: anonCount ?? null,
    error: anonError?.message || null,
  };

  if (supabaseUrl && serviceKey) {
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { error: serviceError, count: serviceCount } = await service
      .from("estoque")
      .select("id", { head: true, count: "exact" });
    result.service_select_estoque = {
      ok: !serviceError,
      count: serviceCount ?? null,
      error: serviceError?.message || null,
    };
  }

  return NextResponse.json({ ok: true, ...result });
}
