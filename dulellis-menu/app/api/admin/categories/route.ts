import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";

const DEFAULT_CATEGORIES = [
  "Bolos",
  "Doces",
  "Salgados",
  "Bebidas",
  "Produtos naturais",
  "Personalizado",
];

function cleanCategory(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 50);
}

function normalizeCategories(value: unknown) {
  const source = Array.isArray(value) ? value : DEFAULT_CATEGORIES;
  const result: string[] = [];
  for (const item of source) {
    const category = cleanCategory(item);
    if (category && !result.some((current) => current.toLocaleLowerCase("pt-BR") === category.toLocaleLowerCase("pt-BR"))) {
      result.push(category);
    }
  }
  return result.length ? result.slice(0, 30) : [...DEFAULT_CATEGORIES];
}

async function authorized(request: NextRequest) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  return enforceSameOriginForWrite(request);
}

async function getConfiguration() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase não configurado.");
  const [configurationResult, productsResult] = await Promise.all([
    supabase
      .from("configuracoes_loja")
      .select("id,categorias_produtos")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("estoque").select("categoria"),
  ]);
  const { data, error } = configurationResult;
  if (error) throw new Error(error.message);
  if (productsResult.error) throw new Error(productsResult.error.message);
  if (!data?.id) throw new Error("Configuração da loja não encontrada.");
  const productCategories = (productsResult.data || []).map((item) => item.categoria);
  const configuredCategories = Array.isArray(data.categorias_produtos)
    ? data.categorias_produtos
    : DEFAULT_CATEGORIES;
  return {
    supabase,
    id: Number(data.id),
    categories: normalizeCategories([...configuredCategories, ...productCategories]),
  };
}

export async function POST(request: NextRequest) {
  const authorizationError = await authorized(request);
  if (authorizationError) return authorizationError;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = cleanCategory(body.name);
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Informe um nome com pelo menos 2 caracteres." }, { status: 400 });
  }

  try {
    const { supabase, id, categories } = await getConfiguration();
    if (categories.some((category) => category.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      return NextResponse.json({ ok: false, error: "Essa categoria já existe." }, { status: 409 });
    }
    if (categories.length >= 30) {
      return NextResponse.json({ ok: false, error: "Limite de 30 categorias atingido." }, { status: 400 });
    }
    const next = [...categories, name];
    const { error } = await supabase.from("configuracoes_loja").update({ categorias_produtos: next }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, categories: next });
  } catch (reason) {
    return NextResponse.json({ ok: false, error: reason instanceof Error ? reason.message : "Falha ao criar categoria." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authorizationError = await authorized(request);
  if (authorizationError) return authorizationError;
  const body = (await request.json().catch(() => ({}))) as { currentName?: string; newName?: string };
  const currentName = cleanCategory(body.currentName);
  const newName = cleanCategory(body.newName);
  if (!currentName || newName.length < 2) {
    return NextResponse.json({ ok: false, error: "Informe os nomes atual e novo da categoria." }, { status: 400 });
  }

  try {
    const { supabase, id, categories } = await getConfiguration();
    const index = categories.findIndex(
      (category) =>
        category.toLocaleLowerCase("pt-BR") === currentName.toLocaleLowerCase("pt-BR"),
    );
    if (index < 0) return NextResponse.json({ ok: false, error: "Categoria não encontrada." }, { status: 404 });
    if (categories.some((category, categoryIndex) => categoryIndex !== index && category.toLocaleLowerCase("pt-BR") === newName.toLocaleLowerCase("pt-BR"))) {
      return NextResponse.json({ ok: false, error: "Já existe uma categoria com esse nome." }, { status: 409 });
    }

    const next = [...categories];
    next[index] = newName;
    const storedCurrentName = categories[index];
    const { error: productsError } = await supabase
      .from("estoque")
      .update({ categoria: newName })
      .eq("categoria", storedCurrentName);
    if (productsError) throw new Error(productsError.message);
    const { error: settingsError } = await supabase.from("configuracoes_loja").update({ categorias_produtos: next }).eq("id", id);
    if (settingsError) {
      await supabase.from("estoque").update({ categoria: storedCurrentName }).eq("categoria", newName);
      throw new Error(settingsError.message);
    }
    return NextResponse.json({ ok: true, categories: next });
  } catch (reason) {
    return NextResponse.json({ ok: false, error: reason instanceof Error ? reason.message : "Falha ao renomear categoria." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authorizationError = await authorized(request);
  if (authorizationError) return authorizationError;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = cleanCategory(body.name);
  if (!name) return NextResponse.json({ ok: false, error: "Categoria inválida." }, { status: 400 });

  try {
    const { supabase, id, categories } = await getConfiguration();
    const { count, error: countError } = await supabase
      .from("estoque")
      .select("id", { count: "exact", head: true })
      .eq("categoria", name);
    if (countError) throw new Error(countError.message);
    if (Number(count || 0) > 0) {
      return NextResponse.json({ ok: false, error: `A categoria possui ${count} produto(s). Edite esses produtos antes de removê-la.` }, { status: 409 });
    }
    const next = categories.filter((category) => category !== name);
    if (!next.length) return NextResponse.json({ ok: false, error: "Mantenha pelo menos uma categoria." }, { status: 400 });
    const { error } = await supabase.from("configuracoes_loja").update({ categorias_produtos: next }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, categories: next });
  } catch (reason) {
    return NextResponse.json({ ok: false, error: reason instanceof Error ? reason.message : "Falha ao remover categoria." }, { status: 500 });
  }
}
