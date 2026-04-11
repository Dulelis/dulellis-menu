import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cleanupExpiredBuckets, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-security";

const DEFAULT_CITY = "Navegantes";
const DEFAULT_STATE = "SC";
const DEFAULT_COUNTRY = "Brasil";
const REQUEST_TIMEOUT_MS = 8000;

type CepLookupResponse = {
  cep?: string;
  address?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  lat?: string;
  lng?: string;
};

type ViaCepCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type ViaCepAddressItem = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type AwesomeCepResponse = {
  cep?: string;
  address?: string;
  district?: string;
  city?: string;
  state?: string;
  lat?: string;
  lng?: string;
  code?: string;
  status?: number;
};

type NominatimAddress = {
  postcode?: string;
  road?: string;
  pedestrian?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  village?: string;
  state?: string;
  state_code?: string;
};

type NominatimItem = {
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizarTexto(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function extrairCidadeNominatim(address?: NominatimAddress): string {
  return String(
    address?.city ||
      address?.town ||
      address?.municipality ||
      address?.village ||
      "",
  ).trim();
}

function extrairBairroNominatim(address?: NominatimAddress): string {
  return String(
    address?.suburb ||
      address?.neighbourhood ||
      address?.quarter ||
      address?.city_district ||
      "",
  ).trim();
}

function getUserAgentHeader(): string {
  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return siteUrl ? `Dulelis Delivery (${siteUrl})` : "Dulelis Delivery";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Lookup failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function buscarViaCepPorCep(cep: string): Promise<CepLookupResponse | null> {
  try {
    const data = await fetchJson<ViaCepCepResponse>(`https://viacep.com.br/ws/${cep}/json/`);
    if (data?.erro) return null;

    return {
      cep: normalizarNumero(String(data.cep || "")).slice(0, 8),
      address: String(data.logradouro || "").trim(),
      complement: String(data.complemento || "").trim(),
      district: String(data.bairro || "").trim(),
      city: String(data.localidade || "").trim(),
      state: String(data.uf || "").trim(),
    };
  } catch {
    return null;
  }
}

async function buscarAwesomePorCep(cep: string): Promise<CepLookupResponse | null> {
  try {
    const data = await fetchJson<AwesomeCepResponse>(`https://cep.awesomeapi.com.br/json/${cep}`);
    if (data?.code || data?.status === 404) return null;

    return {
      cep: normalizarNumero(String(data.cep || cep)).slice(0, 8),
      address: String(data.address || "").trim(),
      district: String(data.district || "").trim(),
      city: String(data.city || "").trim(),
      state: String(data.state || "").trim(),
      lat: String(data.lat || "").trim(),
      lng: String(data.lng || "").trim(),
    };
  } catch {
    return null;
  }
}

async function geocodificarEndereco(query: string, cityHint = ""): Promise<CepLookupResponse | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "br");

    const data = await fetchJson<NominatimItem[]>(url.toString(), {
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": getUserAgentHeader(),
      },
    });

    if (!Array.isArray(data) || data.length === 0) return null;

    const cityNormalizada = normalizarTexto(cityHint);
    const melhorItem =
      data.find((item) => normalizarTexto(extrairCidadeNominatim(item.address)) === cityNormalizada) ||
      data[0];

    const cep = normalizarNumero(String(melhorItem?.address?.postcode || "")).slice(0, 8);

    return {
      cep,
      address: String(melhorItem?.address?.road || melhorItem?.address?.pedestrian || "").trim(),
      district: extrairBairroNominatim(melhorItem?.address),
      city: extrairCidadeNominatim(melhorItem?.address),
      state: String(melhorItem?.address?.state_code || melhorItem?.address?.state || "").trim(),
      lat: String(melhorItem?.lat || "").trim(),
      lng: String(melhorItem?.lon || "").trim(),
    };
  } catch {
    return null;
  }
}

function pontuarResultadoEndereco(
  item: CepLookupResponse,
  street: string,
  number: string,
  district: string,
  city: string,
): number {
  const streetBusca = normalizarTexto(street);
  const districtBusca = normalizarTexto(district);
  const cityBusca = normalizarTexto(city);
  const numeroBusca = Number.parseInt(normalizarNumero(number), 10);
  const streetItem = normalizarTexto(String(item.address || ""));
  const districtItem = normalizarTexto(String(item.district || ""));
  const cityItem = normalizarTexto(String(item.city || ""));

  let score = 0;

  if (streetBusca && streetItem === streetBusca) score += 6;
  else if (streetBusca && (streetItem.includes(streetBusca) || streetBusca.includes(streetItem))) score += 4;

  if (districtBusca && districtItem === districtBusca) score += 5;
  else if (
    districtBusca &&
    districtItem &&
    (districtItem.includes(districtBusca) || districtBusca.includes(districtItem))
  ) {
    score += 3;
  }

  if (cityBusca && cityItem === cityBusca) score += 2;

  if (Number.isFinite(numeroBusca)) {
    const complemento = normalizarTexto(String(item.complement || ""));
    const numerosFaixa = Array.from(complemento.matchAll(/\d+/g))
      .map((match) => Number.parseInt(match[0], 10))
      .filter((value) => Number.isFinite(value));

    if (complemento.includes("ate") && numerosFaixa.length > 0) {
      if (numeroBusca <= Math.max(...numerosFaixa)) score += 8;
      else score -= 4;
    } else if (
      (complemento.includes("ao fim") || complemento.includes("em diante")) &&
      numerosFaixa.length > 0
    ) {
      if (numeroBusca >= Math.min(...numerosFaixa)) score += 8;
      else score -= 4;
    }
  }

  return score;
}

async function buscarViaCepPorEndereco(
  street: string,
  city: string,
  state: string,
): Promise<CepLookupResponse[]> {
  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(state)}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`;
    const data = await fetchJson<unknown>(url);
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const value = item as ViaCepAddressItem;
      return {
        cep: normalizarNumero(String(value.cep || "")).slice(0, 8),
        address: String(value.logradouro || "").trim(),
        complement: String(value.complemento || "").trim(),
        district: String(value.bairro || "").trim(),
        city: String(value.localidade || "").trim(),
        state: String(value.uf || "").trim(),
      };
    }).filter((item) => item.cep);
  } catch {
    return [];
  }
}

async function consultarPorCep(cep: string): Promise<CepLookupResponse | null> {
  const viaCep = await buscarViaCepPorCep(cep);
  if (!viaCep) return null;

  const awesome = await buscarAwesomePorCep(cep);
  if (awesome?.lat && awesome?.lng) {
    return {
      ...viaCep,
      ...awesome,
      cep,
    };
  }

  const geocodificado = await geocodificarEndereco(
    [viaCep.address, viaCep.district, viaCep.city, viaCep.state || DEFAULT_STATE, cep, DEFAULT_COUNTRY]
      .filter(Boolean)
      .join(", "),
    viaCep.city || DEFAULT_CITY,
  );

  return {
    ...viaCep,
    ...geocodificado,
    cep,
  };
}

async function consultarPorEndereco(
  street: string,
  number: string,
  district: string,
  city: string,
  state: string,
): Promise<CepLookupResponse | null> {
  const queryCompleta = [street, number, district, city, state, DEFAULT_COUNTRY].filter(Boolean).join(", ");

  const candidatos = await buscarViaCepPorEndereco(street, city, state);
  const melhorViaCep = [...candidatos].sort(
    (a, b) =>
      pontuarResultadoEndereco(b, street, number, district, city) -
      pontuarResultadoEndereco(a, street, number, district, city),
  )[0];

  if (melhorViaCep?.cep) {
    const detalhado = await consultarPorCep(melhorViaCep.cep);
    return {
      ...melhorViaCep,
      ...detalhado,
      cep: detalhado?.cep || melhorViaCep.cep,
    };
  }

  const geocodificado = await geocodificarEndereco(queryCompleta, city);
  const cepGeocodificado = normalizarNumero(String(geocodificado?.cep || "")).slice(0, 8);
  if (cepGeocodificado.length !== 8) return null;

  const detalhado = await consultarPorCep(cepGeocodificado);
  return {
    ...geocodificado,
    ...detalhado,
    cep: detalhado?.cep || cepGeocodificado,
  };
}

export async function GET(request: NextRequest) {
  cleanupExpiredBuckets();
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `public-cep-get:${ip}`,
    limit: 90,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas consultas de CEP. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const cep = normalizarNumero(searchParams.get("cep") || "").slice(0, 8);
  const street = String(searchParams.get("street") || "").trim();
  const number = String(searchParams.get("number") || "").trim();
  const district = String(searchParams.get("district") || "").trim();
  const city = String(searchParams.get("city") || "").trim() || DEFAULT_CITY;
  const state = String(searchParams.get("state") || "").trim().toUpperCase() || DEFAULT_STATE;

  try {
    if (cep) {
      if (cep.length !== 8) {
        return NextResponse.json({ ok: false, error: "CEP invalido." }, { status: 400 });
      }

      const data = await consultarPorCep(cep);
      if (!data) {
        return NextResponse.json({ ok: false, error: "CEP nao encontrado." }, { status: 404 });
      }

      return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
    }

    if (street) {
      const data = await consultarPorEndereco(street, number, district, city, state);
      if (!data?.cep) {
        return NextResponse.json(
          { ok: false, error: "Nao foi possivel localizar o CEP por esse endereco." },
          { status: 404 },
        );
      }

      return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      { ok: false, error: "Informe um CEP ou uma rua para consultar." },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel consultar o CEP agora." },
      { status: 500 },
    );
  }
}
