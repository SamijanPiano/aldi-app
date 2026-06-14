// format.js — Geld- und Datumsformatierung. Geld wird intern IMMER in Cent
// (ganze Zahlen) gehalten, um Rundungsfehler zu vermeiden.

/** Cent -> "1,49 €" */
export function euro(cents) {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

/** Cent -> "1,49" (ohne Währungssymbol, für Eingabefelder) */
export function euroPlain(cents) {
  return ((cents ?? 0) / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Freitext-Eingabe ("1,49", "1.49", "1,5", "2") -> Cent (ganzzahlig).
 * Gibt null zurück, wenn nichts Sinnvolles erkennbar ist.
 */
export function parseEuro(text) {
  if (text == null) return null;
  let s = String(text).trim().replace(/[^0-9.,-]/g, "");
  if (s === "" || s === "-") return null;
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Deutsches Format: Punkt = Tausender, Komma = Dezimaltrenner ("1.000,49").
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    // Einzelner Punkt mit 1–2 Nachkommastellen = Dezimaltrenner ("1.49").
    // Mehrere Punkte oder exakt drei Nachkommastellen = Tausender ("1.000").
    const groups = s.split(".");
    const lastLen = groups[groups.length - 1].length;
    if (groups.length > 2 || lastLen === 3) s = s.replace(/\./g, "");
  }

  const num = parseFloat(s);
  if (Number.isNaN(num)) return null;
  const cents = Math.round(num * 100);
  return negative ? -cents : cents;
}

/** ISO-Datum (YYYY-MM-DD) -> "Fr, 13. Juni" */
export function dateLabel(iso) {
  const d = isoToDate(iso);
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

/** ISO-Datum -> "13.06.2026" */
export function dateShort(iso) {
  return isoToDate(iso).toLocaleDateString("de-DE");
}

/** Heutiges Datum als YYYY-MM-DD (lokale Zeitzone) */
export function todayIso() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function isoToDate(iso) {
  // Mittag, damit Zeitzonen-Verschiebungen nicht aufs Vortagsdatum kippen.
  return new Date(`${iso}T12:00:00`);
}
