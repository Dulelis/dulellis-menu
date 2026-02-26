import { NextRequest, NextResponse } from "next/server";

const FORMAS_CARTAO = new Set(["Cartao de Debito", "Cartao de Credito"]);
const URL_ORIGEM_PADRAO = "https://deliverydulelisconfeitaria.netlify.app/";

type BodyPagamento = {
  formaPagamento?: string;
  total?: number;
  cliente?: {
    nome?: string;
    whatsapp?: string;
  };
  itens?: Array<{
    id?: number;
    nome?: string;
    qtd?: number;
    preco?: number;
  }>;
};

export async function POST(req: NextRequest) {
  const token = process.env.CARTAO_API_TOKEN;
  const appKey = process.env.PAGBANK_APP_KEY ?? token;
  const urlConfigurada = process.env.CARTAO_API_URL;
  const origem = process.env.CARTAO_SOURCE_URL ?? URL_ORIGEM_PADRAO;

  if (!token || !urlConfigurada) {
    return NextResponse.json(
      { error: "Configuracao de pagamento indisponivel." },
      { status: 500 },
    );
  }

  let body: BodyPagamento;
  try {
    body = (await req.json()) as BodyPagamento;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const forma = String(body.formaPagamento ?? "");
  if (!FORMAS_CARTAO.has(forma)) {
    return NextResponse.json({ error: "Forma de pagamento nao suportada." }, { status: 400 });
  }

  const payload = {
    ...body,
    origem,
    timestamp: new Date().toISOString(),
  };

  let endpointPagamento = urlConfigurada;
  let endpointsCandidatos: string[] = [];
  try {
    const parsed = new URL(urlConfigurada);
    if (!parsed.pathname || parsed.pathname === "/") {
      endpointsCandidatos = [
        new URL("/.netlify/functions/pagamento-cartao", parsed.origin).toString(),
        new URL("/.netlify/functions/cartao", parsed.origin).toString(),
        new URL("/api/pagamento/cartao", parsed.origin).toString(),
      ];
      endpointPagamento = endpointsCandidatos[0];
    } else {
      endpointsCandidatos = [parsed.toString()];
    }
  } catch {
    return NextResponse.json(
      { error: "CARTAO_API_URL invalida." },
      { status: 500 },
    );
  }

  const endpointLocal = `${req.nextUrl.origin}/api/pagamento/cartao`;
  if (endpointsCandidatos.some((url) => url.replace(/\/$/, "") === endpointLocal.replace(/\/$/, ""))) {
    return NextResponse.json(
      {
        error: "CARTAO_API_URL aponta para a propria rota local. Configure um endpoint externo.",
      },
      { status: 500 },
    );
  }

  const tentativas: Array<{ endpoint: string; status?: number; detalhe?: unknown }> = [];

  for (const endpoint of endpointsCandidatos) {
    endpointPagamento = endpoint;
    try {
      const resposta = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": String(appKey ?? ""),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const texto = await resposta.text();
      let data: unknown = null;

      try {
        data = texto ? (JSON.parse(texto) as unknown) : null;
      } catch {
        data = { raw: texto };
      }

      if (resposta.ok) {
        return NextResponse.json({ ok: true, endpoint, data });
      }

      tentativas.push({ endpoint, status: resposta.status, detalhe: data });
    } catch {
      tentativas.push({ endpoint, detalhe: "Falha de conexao" });
    }
  }

  const ultimoStatus = tentativas[tentativas.length - 1]?.status ?? 502;
  return NextResponse.json(
    {
      error: "Falha na API de pagamento.",
      endpoint: endpointPagamento,
      tentativas,
    },
    { status: ultimoStatus },
  );
}
