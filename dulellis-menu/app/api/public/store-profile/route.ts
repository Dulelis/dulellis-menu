import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { DEFAULT_STORE_PROFILES, readStoreProfiles, type StoreChannel } from "@/lib/store-profiles";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("canal");
  const channel: StoreChannel = requested === "naturais" || requested === "encomendas" ? requested : "delivery";
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ profile: DEFAULT_STORE_PROFILES[channel] });
  try { return NextResponse.json({ profile: (await readStoreProfiles(db)).profiles[channel] }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ profile: DEFAULT_STORE_PROFILES[channel] }); }
}
