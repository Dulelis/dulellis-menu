import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import { getServiceSupabase } from "@/lib/server-supabase";
import { checkRateLimit, cleanupExpiredBuckets } from "@/lib/rate-limit";
import { enforceSameOriginForWrite, getClientIp } from "@/lib/request-security";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Entre na sua conta para enviar a foto." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  cleanupExpiredBuckets();
  const rate = await checkRateLimit({
    key: `preorder-reference-image:${session.clienteId}:${getClientIp(request)}`,
    limit: 12,
    windowMs: 10 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Muitas fotos enviadas. Aguarde alguns minutos." }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Selecione uma foto." }, { status: 400 });
  }
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json({ ok: false, error: "Use uma foto JPG, PNG ou WEBP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: "A foto deve ter no maximo 5 MB." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 500 });
  const path = `encomendas/${Number(session.clienteId)}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("fotos-produtos")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ ok: false, error: `Falha ao salvar a foto: ${error.message}` }, { status: 500 });
  const { data } = supabase.storage.from("fotos-produtos").getPublicUrl(path);
  return NextResponse.json({ ok: true, data: { url: data.publicUrl, nome: file.name } });
}
