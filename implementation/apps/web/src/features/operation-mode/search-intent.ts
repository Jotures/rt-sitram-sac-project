import type { AdminListRow } from "../admin-ui/admin-data";
import { matchesSearch, normalizeSearch } from "./workspace-model";

export interface SearchIntent {
  readonly text: string;
  readonly category: string | null;
  readonly pendingAccount: boolean;
  readonly status: "pending" | "observed" | null;
  readonly from: string | null;
  readonly until: string | null;
  readonly labels: readonly string[];
}

const categories: readonly [RegExp, string][] = [
  [/\b(combustible|abastecimientos?)\b/, "Combustible"],
  [/\bgastos?\b/, "Gasto"],
  [/\bsalidas?\b/, "Salida"],
  [/\brendicion(?:es)?\b/, "Rendición"],
  [/\b(adelantos?|dinero entregado)\b/, "Dinero entregado"],
  [/\b(servicios?|fletes?|viajes?)\b/, "Servicio"],
];
function peruDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function dayOffset(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** A deliberately bounded parser. Unrecognized words remain visible as search text. */
export function parseSearchIntent(query: string, now = new Date()): SearchIntent {
  let text = normalizeSearch(query);
  const labels: string[] = [];
  // Negation must not accidentally become a positive filter.
  if (/\b(no|sin|excepto)\b/.test(text))
    return {
      text: query,
      category: null,
      pendingAccount: false,
      status: null,
      from: null,
      until: null,
      labels: [],
    };
  let category: string | null = null;
  for (const [pattern, name] of categories) {
    if (pattern.test(text)) {
      category = name;
      text = text.replace(pattern, " ");
      labels.push(name);
      break;
    }
  }
  const pendingAccount = /\bpendientes? de rendir\b/.test(text);
  let status: SearchIntent["status"] = null;
  if (pendingAccount) {
    text = text.replace(/\bpendientes? de rendir\b/, " ");
    if (!category) {
      category = "Salida";
      labels.unshift("Salida");
    }
    labels.push("Rendición pendiente");
  } else if (category && /\bobservad[oa]s?\b/.test(text)) {
    text = text.replace(/\bobservad[oa]s?\b/, " ");
    status = "observed";
    labels.push("Con observaciones");
  } else if (category && /\bpendientes?\b/.test(text)) {
    text = text.replace(/\bpendientes?\b/, " ");
    status = "pending";
    labels.push("Pendiente");
  }
  let from: string | null = null,
    until: string | null = null;
  const today = peruDay(now);
  const periods: readonly [RegExp, string, () => [string, string]][] = [
    [/\b(este mes|del mes)\b/, "Este mes", () => [today.slice(0, 7) + "-01", today]],
    [
      /\bmes pasado\b/,
      "Mes pasado",
      () => {
        const end = dayOffset(today.slice(0, 7) + "-01", -1);
        return [end.slice(0, 7) + "-01", end];
      },
    ],
    [
      /\besta semana\b/,
      "Esta semana",
      () => [dayOffset(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7)), today],
    ],
    [/\bhoy\b/, "Hoy", () => [today, today]],
    [/\bayer\b/, "Ayer", () => [dayOffset(today, -1), dayOffset(today, -1)]],
  ];
  for (const [pattern, label, range] of periods) {
    if (pattern.test(text)) {
      [from, until] = range();
      text = text.replace(pattern, " ");
      labels.push(`${label}: ${from} a ${until}`);
      break;
    }
  }
  if (labels.length) text = text.replace(/\b(de|del|la|el|los|las|en|para)\b/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text && labels.length) labels.push(`Texto: ${text}`);
  return { text, category, pendingAccount, status, from, until, labels };
}

export interface SearchableRecord extends AdminListRow {
  readonly category: string;
  readonly pendingAccount?: boolean | undefined;
}
export function matchesSearchIntent(row: SearchableRecord, intent: SearchIntent): boolean {
  if (intent.category && row.category !== intent.category) return false;
  if (intent.pendingAccount && row.pendingAccount !== true) return false;
  const status = normalizeSearch(row.rawStatus ?? row.status);
  if (intent.status === "observed" && !status.includes("observ")) return false;
  if (
    intent.status === "pending" &&
    !/pending|pendiente|abiert|open|draft|borrador|submitted/.test(status)
  )
    return false;
  if (intent.from || intent.until) {
    if (!row.date || !Number.isFinite(Date.parse(row.date))) return false;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : peruDay(new Date(row.date));
    if ((intent.from && day < intent.from) || (intent.until && day > intent.until)) return false;
  }
  return matchesSearch(
    `${row.title} ${row.description} ${row.technicalReference ?? ""} ${row.category} ${row.date ?? ""} ${row.date ? new Date(row.date).toLocaleDateString("es-PE") : ""}`,
    intent.text,
  );
}
