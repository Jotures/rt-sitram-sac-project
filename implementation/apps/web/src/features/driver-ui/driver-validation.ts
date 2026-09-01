export function parsePositiveNumber(value: string, label: string): number {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  if (normalized.length === 0 || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`);
  }

  return parsed;
}

export function parseNonNegativeNumber(value: string, label: string): number {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  if (normalized.length === 0 || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} debe ser un número no negativo.`);
  }

  return parsed;
}

export function requireDriverText(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${label} es obligatorio.`);
  }

  return normalized;
}

export function toIsoFromLocalInput(value: string): string {
  const parsed = new Date(value);

  if (value.trim().length === 0 || Number.isNaN(parsed.valueOf())) {
    throw new Error("La fecha y hora no son válidas.");
  }

  return parsed.toISOString();
}

export function localDateTimeValue(now = new Date()): string {
  const offsetMilliseconds = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

export function deriveFuelUnitPrice(quantity: number, total: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(total) || total <= 0) {
    throw new Error("Cantidad y monto deben ser mayores que cero.");
  }

  return Math.round((total / quantity) * 10_000) / 10_000;
}
