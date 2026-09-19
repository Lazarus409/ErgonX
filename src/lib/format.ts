/**
 * Display formatting helpers.
 *
 * Presentation only. Business calculations stay on the backend, which is
 * authoritative for balances, payroll and accounting figures.
 */

export const EM_DASH = "—";

/**
 * Formats a Date as `YYYY-MM-DD` in local time.
 *
 * `toISOString()` converts to UTC first, which shifts a local midnight into
 * the previous day for any positive UTC offset. Calendar cells and date
 * filters must use the local calendar date.
 */
export function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Formats an ISO date (YYYY-MM-DD) as `12 Jan 2023`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return EM_DASH;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return EM_DASH;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a backend decimal string without re-deriving it. Decimal amounts
 * arrive as strings to preserve precision, so they are parsed for display
 * only.
 */
export function formatAmount(
  value: string | number | null | undefined,
  currency?: string,
): string {
  if (value === null || value === undefined || value === "") {
    return EM_DASH;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numeric)) {
    return String(value);
  }

  const formatted = numeric.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currency ? `${currency} ${formatted}` : formatted;
}

export function formatNumber(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return EM_DASH;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isNaN(numeric) ? String(value) : numeric.toLocaleString("en-GB");
}

/** Turns a backend enum such as `PART_PAID` into `Part Paid`. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) {
    return EM_DASH;
  }

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
