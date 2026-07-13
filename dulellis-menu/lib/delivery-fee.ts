import type { ServiceSupabaseClient } from "@/lib/order-draft";

const STORE_LATITUDE = -26.8882331;
const STORE_LONGITUDE = -48.6518957;
const DISTANCE_MULTIPLIER = 1.3;
const SERVED_CITY = "Navegantes";
const LOOKUP_TIMEOUT_MS = 8_000;

type DeliveryCustomerAddress = {
  cep: string;
  cidade: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
};

type AwesomeCepResponse = {
  city?: string;
  lat?: string;
  lng?: string;
  code?: string;
  status?: number;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type NominatimResponse = Array<{
  lat?: string;
  lon?: string;
  address?: { city?: string; town?: string; municipality?: string };
}>;

export class DeliveryFeeError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DeliveryFeeError";
    this.status = status;
  }
}

function normalizeDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function distanceInKm(latitude: number, longitude: number) {
  const earthRadiusKm = 6371;
  const deltaLatitude = ((latitude - STORE_LATITUDE) * Math.PI) / 180;
  const deltaLongitude = ((longitude - STORE_LONGITUDE) * Math.PI) / 180;
  const originLatitude = (STORE_LATITUDE * Math.PI) / 180;
  const destinationLatitude = (latitude * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * DISTANCE_MULTIPLIER;
}

async function lookupAwesomeCoordinates(cep: string) {
  try {
    const response = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as AwesomeCepResponse;
    const latitude = Number(data.lat);
    const longitude = Number(data.lng);
    if (data.code || data.status === 404 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude, city: String(data.city || "").trim() };
  } catch {
    return null;
  }
}

async function lookupViaCep(cep: string) {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as ViaCepResponse;
    if (data.erro) throw new DeliveryFeeError(400, "CEP nao encontrado para calcular a entrega.");
    return data;
  } catch (error) {
    if (error instanceof DeliveryFeeError) throw error;
    return null;
  }
}

async function lookupNominatimCoordinates(address: DeliveryCustomerAddress, cep: string, viaCep: ViaCepResponse) {
  const query = [
    address.endereco || viaCep.logradouro,
    address.numero,
    address.bairro || viaCep.bairro,
    address.cidade || viaCep.localidade,
    viaCep.uf || "SC",
    cep,
    "Brasil",
  ].filter(Boolean).join(", ");
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": `Dulelis Delivery (${String(process.env.NEXT_PUBLIC_SITE_URL || "dulelisdelivery.com.br")})`,
      },
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => [])) as NominatimResponse;
    const result = data[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      city: String(
        result?.address?.city || result?.address?.town || result?.address?.municipality || viaCep.localidade || address.cidade || "",
      ).trim(),
    };
  } catch {
    return null;
  }
}

async function lookupCoordinates(address: DeliveryCustomerAddress, cep: string) {
  const awesome = await lookupAwesomeCoordinates(cep);
  if (awesome) return awesome;

  const viaCep = await lookupViaCep(cep);
  if (!viaCep) {
    throw new DeliveryFeeError(503, "Nao foi possivel consultar o CEP agora. Tente novamente em instantes.");
  }
  const nominatim = await lookupNominatimCoordinates(address, cep, viaCep);
  if (nominatim) return nominatim;
  throw new DeliveryFeeError(503, "Nao foi possivel localizar o endereco para calcular a entrega agora.");
}

export async function calculateServerDeliveryFee(
  supabase: ServiceSupabaseClient,
  address: DeliveryCustomerAddress,
) {
  const cep = normalizeDigits(address.cep).slice(0, 8);
  if (cep.length !== 8) {
    throw new DeliveryFeeError(400, "Informe um CEP valido para entrega.");
  }
  const coordinates = await lookupCoordinates(address, cep);
  const city = coordinates.city || String(address.cidade || "");
  if (normalizeText(city) !== normalizeText(SERVED_CITY)) {
    throw new DeliveryFeeError(400, "Entrega disponivel somente em Navegantes.");
  }

  const { data, error } = await supabase.from("taxas_entrega").select("bairro,taxa");
  if (error) {
    throw new DeliveryFeeError(503, "Nao foi possivel consultar as taxas de entrega.");
  }
  const brackets = ((data || []) as Array<{ bairro?: string | null; taxa?: number | string | null }>)
    .map((row) => {
      const match = String(row.bairro || "").match(/\d+(?:[.,]\d+)?/);
      return {
        maxDistance: match ? Number(match[0].replace(",", ".")) : Number.NaN,
        fee: Number(row.taxa),
      };
    })
    .filter((row) => Number.isFinite(row.maxDistance) && Number.isFinite(row.fee) && row.fee >= 0)
    .sort((left, right) => left.maxDistance - right.maxDistance);

  const distance = distanceInKm(coordinates.latitude, coordinates.longitude);
  const bracket = brackets.find((row) => distance <= row.maxDistance);
  if (!bracket) {
    throw new DeliveryFeeError(400, "Endereco fora da area de entrega configurada.");
  }
  return { fee: bracket.fee, distanceKm: distance };
}
