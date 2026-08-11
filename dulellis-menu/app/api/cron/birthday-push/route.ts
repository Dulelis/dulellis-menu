import { NextResponse, type NextRequest } from "next/server";
import { runBirthdayPushAutomation } from "@/lib/push-audiences";
import { isWebPushConfigured } from "@/lib/web-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = String(process.env.CRON_SECRET || "").trim();
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ ok: false, error: "Web Push não configurado." }, { status: 503 });
  }

  try {
    const result = await runBirthdayPushAutomation();
    return NextResponse.json({ ok: true, result });
  } catch (reason) {
    const error = reason instanceof Error ? reason.message : "Falha na automação de aniversários.";
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
