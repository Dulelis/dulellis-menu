import type { ServiceSupabaseClient } from "@/lib/order-draft";

export const STORE_TIMEZONE = "America/Sao_Paulo";

const WEEKDAYS = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

type Weekday = (typeof WEEKDAYS)[number];

type StoreScheduleRow = {
  hora_abertura?: string | null;
  hora_fechamento?: string | null;
  ativo?: boolean | null;
  dias_semana?: string[] | null;
};

export type DeliveryAvailability = {
  open: boolean;
  reason: "open" | "disabled" | "closed_day" | "outside_hours" | "configuration_error";
  message: string;
};

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseTimeToMinutes(value?: string | null) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function zonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayIndex = weekdayMap[String(parts.weekday || "")];
  const hours = Number(parts.hour);
  const minutes = Number(parts.minute);
  if (!Number.isInteger(weekdayIndex) || !Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return { weekdayIndex, minutes: hours * 60 + minutes };
}

function normalizeWeekdays(days?: string[] | null): Set<Weekday> {
  const normalized = (Array.isArray(days) ? days : [])
    .map((day) => normalizeText(day))
    .filter((day): day is Weekday => (WEEKDAYS as readonly string[]).includes(day));
  return new Set(normalized.length > 0 ? normalized : WEEKDAYS);
}

export function evaluateDeliveryAvailability(
  schedule: StoreScheduleRow | null,
  now = new Date(),
  timeZone = STORE_TIMEZONE,
): DeliveryAvailability {
  if (!schedule) {
    return {
      open: false,
      reason: "configuration_error",
      message: "Horario do delivery nao configurado.",
    };
  }
  if (schedule.ativo === false) {
    return {
      open: false,
      reason: "disabled",
      message: "O delivery esta fechado no momento.",
    };
  }

  const opening = parseTimeToMinutes(schedule.hora_abertura);
  const closing = parseTimeToMinutes(schedule.hora_fechamento);
  const current = zonedDateParts(now, timeZone);
  if (opening === null || closing === null || !current) {
    return {
      open: false,
      reason: "configuration_error",
      message: "Horario do delivery invalido.",
    };
  }

  let operationalWeekdayIndex = current.weekdayIndex;
  let insideHours = false;
  if (closing > opening) {
    insideHours = current.minutes >= opening && current.minutes < closing;
  } else {
    insideHours = current.minutes >= opening || current.minutes < closing;
    if (current.minutes < closing) {
      operationalWeekdayIndex = (current.weekdayIndex + 6) % 7;
    }
  }

  const operationalDay = WEEKDAYS[operationalWeekdayIndex];
  if (!normalizeWeekdays(schedule.dias_semana).has(operationalDay)) {
    return {
      open: false,
      reason: "closed_day",
      message: "O delivery nao funciona neste dia.",
    };
  }
  if (!insideHours) {
    return {
      open: false,
      reason: "outside_hours",
      message: "O delivery esta fora do horario de funcionamento.",
    };
  }
  return { open: true, reason: "open", message: "Delivery aberto." };
}

export async function getDeliveryAvailability(
  supabase: ServiceSupabaseClient,
  now = new Date(),
): Promise<DeliveryAvailability> {
  const { data, error } = await supabase
    .from("configuracoes_loja")
    .select("hora_abertura,hora_fechamento,ativo,dias_semana")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      open: false,
      reason: "configuration_error",
      message: "Nao foi possivel validar o horario do delivery.",
    };
  }
  return evaluateDeliveryAvailability((data || null) as StoreScheduleRow | null, now);
}
