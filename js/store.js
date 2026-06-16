// store.js — Datenhaltung. Eine einzige Quelle der Wahrheit, persistiert als
// JSON im localStorage. Alle Beträge in Cent (ganze Zahlen).
//
// Datenmodell:
//   person  : { id, name, balance }
//             balance > 0  -> Guthaben (du schuldest der Person Geld)
//             balance < 0  -> die Person schuldet dir Geld
//   product : { id, name, lastPrice }   // zuletzt gezahlter Preis in Cent
//   trip    : { id, date, orders: [order] }   // ein Einkauf/Eintrag, 1..n Personen
//   order   : { personId, items: [item], paid, amountPaid }
//             amountPaid = tatsächlich erhaltener Betrag in Cent (oder null)
//   item    : { productId, label, qty, price }   // price = Stückpreis in Cent
//             productId gesetzt -> wiederkehrender Artikel (Vorschläge + Preisgedächtnis)
//             label gesetzt     -> einmalige Auslage ("Konzertticket"), kein Produkt

import { recomputeAllBalances } from "./algorithm.js";
import { todayIso } from "./format.js";

const STORAGE_KEY = "saldo-app-v1";
// Frühere Schlüssel: werden beim ersten Start einmalig übernommen, damit beim
// Umstieg von der Aldi-Version keine Daten verloren gehen.
const LEGACY_KEYS = ["aldi-app-v1"];
const SCHEMA_VERSION = 1;
const MAX_ENTITIES = 20000; // Obergrenze gegen riesige/böswillige Backups

const listeners = new Set();

let state = load();

// Salden direkt aus den Bestellungen neu berechnen – unabhängig davon, welche
// (ggf. importierten oder alten) Werte gespeichert waren. Single Source of Truth.
recomputeAllBalances(state);

// Falls aus dem Alt-Speicher übernommen: einmalig unter dem neuen Schlüssel
// sichern, damit die Daten auch ohne weitere Änderung erhalten bleiben.
if (!localStorage.getItem(STORAGE_KEY) && (state.people.length || state.trips.length)) {
  persist();
}

function emptyState() {
  return { version: SCHEMA_VERSION, people: [], products: [], trips: [] };
}

function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Beim ersten Start unter neuem Schlüssel: Alt-Speicher übernehmen.
      for (const k of LEGACY_KEYS) {
        const legacy = localStorage.getItem(k);
        if (legacy) {
          raw = legacy;
          break;
        }
      }
    }
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (err) {
    console.error("Konnte Daten nicht laden, starte leer:", err);
    return emptyState();
  }
}

// Bereinigt beliebige (auch importierte/manipulierte) Daten auf bekannte,
// skalare Felder. Schützt vor Prototype-Pollution und kaputten Backups und
// ergänzt fehlende IDs (z. B. Artikel-IDs aus älteren Datenständen).
function migrate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return emptyState();
  const arr = (v, fn) =>
    Array.isArray(v) ? v.slice(0, MAX_ENTITIES).map(fn).filter(Boolean) : [];
  return {
    version: SCHEMA_VERSION,
    people: arr(data.people, sanitizePerson),
    products: arr(data.products, sanitizeProduct),
    trips: arr(data.trips, sanitizeTrip),
  };
}

// Als Funktionsdeklarationen (gehoben), damit sie beim Modulstart in `load()`
// schon verfügbar sind – ein `const` stünde hier in der Temporal Dead Zone.
function str(v, max = 200) {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function int(v) {
  return Number.isFinite(v) ? Math.trunc(v) : null;
}

function sanitizePerson(p) {
  if (!p || typeof p !== "object") return null;
  const name = str(p.name).trim();
  if (!name) return null;
  return { id: str(p.id) || uid("p"), name, balance: 0 };
}

function sanitizeProduct(p) {
  if (!p || typeof p !== "object") return null;
  const name = str(p.name).trim();
  if (!name) return null;
  return { id: str(p.id) || uid("a"), name, lastPrice: int(p.lastPrice) };
}

function sanitizeItem(it) {
  if (!it || typeof it !== "object") return null;
  const productId = str(it.productId);
  const label = str(it.label).trim();
  // Entweder ein Produkt-Verweis ODER eine freie Auslage muss vorhanden sein.
  if (!productId && !label) return null;
  const qty = int(it.qty);
  return {
    id: str(it.id) || uid("i"),
    productId: productId || null,
    label: label || null,
    qty: qty && qty > 0 ? qty : 1,
    price: int(it.price), // null = Preis unbekannt
  };
}

function sanitizeOrder(o) {
  if (!o || typeof o !== "object") return null;
  const personId = str(o.personId);
  if (!personId) return null;
  return {
    personId,
    items: Array.isArray(o.items) ? o.items.map(sanitizeItem).filter(Boolean) : [],
    paid: o.paid === true,
    amountPaid: o.amountPaid == null ? null : int(o.amountPaid),
  };
}

function sanitizeTrip(t) {
  if (!t || typeof t !== "object") return null;
  return {
    id: str(t.id) || uid("t"),
    date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayIso(),
    orders: Array.isArray(t.orders) ? t.orders.map(sanitizeOrder).filter(Boolean) : [],
  };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Speichern fehlgeschlagen:", err);
    alert(
      "Speicher voll oder nicht verfügbar. Bitte über Einstellungen ein Backup exportieren."
    );
  }
}

/** Liefert eine schreibgeschützte Sicht auf den State. */
export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Mutiert den State über `mutator`, schreibt unveränderliche Kopien,
 * persistiert und benachrichtigt Abonnenten. Vor dem Speichern werden
 * alle Salden neu aus den Bestellungen berechnet (Single Source of Truth).
 */
export function commit(mutator) {
  const next = mutator(structuredClone(state));
  recomputeAllBalances(next);
  state = next;
  persist();
  listeners.forEach((fn) => fn(state));
}

function uid(prefix) {
  const rand =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}

// ---- Lookups -------------------------------------------------------------

export function personById(id, s = state) {
  return s.people.find((p) => p.id === id) || null;
}

export function productById(id, s = state) {
  return s.products.find((p) => p.id === id) || null;
}

export function tripById(id, s = state) {
  return s.trips.find((t) => t.id === id) || null;
}

// ---- Personen ------------------------------------------------------------

export function addPerson(name) {
  const id = uid("p");
  commit((s) => {
    s.people.push({ id, name: name.trim(), balance: 0 });
    return s;
  });
  return id;
}

export function renamePerson(id, name) {
  commit((s) => {
    const p = personById(id, s);
    if (p) p.name = name.trim();
    return s;
  });
}

export function removePerson(id) {
  commit((s) => {
    s.people = s.people.filter((p) => p.id !== id);
    s.trips.forEach((t) => {
      t.orders = t.orders.filter((o) => o.personId !== id);
    });
    return s;
  });
}

// ---- Produkte ------------------------------------------------------------

/** Findet ein Produkt per Name (case-insensitiv) oder legt es neu an. */
export function ensureProduct(s, name) {
  const norm = name.trim().toLowerCase();
  let prod = s.products.find((p) => p.name.toLowerCase() === norm);
  if (!prod) {
    prod = { id: uid("a"), name: name.trim(), lastPrice: null };
    s.products.push(prod);
  }
  return prod;
}

// ---- Einkaufsfahrten -----------------------------------------------------

export function addTrip(dateIso) {
  const id = uid("t");
  commit((s) => {
    s.trips.push({ id, date: dateIso, orders: [] });
    return s;
  });
  return id;
}

export function removeTrip(id) {
  commit((s) => {
    s.trips = s.trips.filter((t) => t.id !== id);
    return s;
  });
}

/** Ändert das Datum eines Einkaufs/Eintrags (YYYY-MM-DD). */
export function setTripDate(id, dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
  commit((s) => {
    const t = tripById(id, s);
    if (t) t.date = dateIso;
    return s;
  });
}

/** Fügt einer Fahrt eine Person hinzu (leere Bestellung). */
export function addPersonToTrip(tripId, personId) {
  commit((s) => {
    const t = tripById(tripId, s);
    if (!t) return s;
    if (!personById(personId, s)) return s; // keine Geister-Bestellungen anlegen
    if (t.orders.some((o) => o.personId === personId)) return s;
    t.orders.push({ personId, items: [], paid: false, amountPaid: null });
    return s;
  });
}

export function removeOrder(tripId, personId) {
  commit((s) => {
    const t = tripById(tripId, s);
    if (t) t.orders = t.orders.filter((o) => o.personId !== personId);
    return s;
  });
}

/** Fügt einer Bestellung einen wiederkehrenden Artikel hinzu (legt Produkt bei Bedarf an). */
export function addItem(tripId, personId, name, priceCents, qty = 1) {
  commit((s) => {
    const t = tripById(tripId, s);
    const order = t?.orders.find((o) => o.personId === personId);
    if (!order) return s;
    const prod = ensureProduct(s, name);
    const price = priceCents ?? prod.lastPrice ?? null;
    if (price != null) prod.lastPrice = price;
    order.items.push({ id: uid("i"), productId: prod.id, label: null, qty, price });
    return s;
  });
}

/**
 * Fügt einer Bestellung eine einmalige Auslage hinzu (freier Text + Betrag,
 * ohne Produkt – taucht nicht in den Vorschlägen auf, kein Preisgedächtnis).
 */
export function addFreeItem(tripId, personId, label, priceCents, qty = 1) {
  const text = label.trim();
  if (!text) return;
  commit((s) => {
    const order = tripById(tripId, s)?.orders.find((o) => o.personId === personId);
    if (!order) return s;
    order.items.push({ id: uid("i"), productId: null, label: text, qty, price: priceCents ?? null });
    return s;
  });
}

// Mengenänderung per Delta und stabiler Artikel-ID: robust gegen schnelle
// Doppel-Taps (jeder Klick liest den frischen Stand statt eines Closure-Werts).
export function changeItemQty(tripId, personId, itemId, delta) {
  commit((s) => {
    const order = tripById(tripId, s)?.orders.find((o) => o.personId === personId);
    if (!order) return s;
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return s;
    const next = item.qty + delta;
    if (next <= 0) order.items = order.items.filter((i) => i.id !== itemId);
    else item.qty = next;
    return s;
  });
}

export function setItemPrice(tripId, personId, itemId, priceCents) {
  commit((s) => {
    const order = tripById(tripId, s)?.orders.find((o) => o.personId === personId);
    const item = order?.items.find((i) => i.id === itemId);
    if (!item) return s;
    item.price = priceCents;
    const prod = productById(item.productId, s);
    if (prod && priceCents != null) prod.lastPrice = priceCents;
    return s;
  });
}

/** Setzt Bezahlstatus. amountPaid = null => "genau passend / verrechnet". */
export function setPayment(tripId, personId, { paid, amountPaid }) {
  commit((s) => {
    const order = tripById(tripId, s)?.orders.find((o) => o.personId === personId);
    if (!order) return s;
    if (paid !== undefined) order.paid = paid;
    if (amountPaid !== undefined) order.amountPaid = amountPaid;
    return s;
  });
}

// ---- Backup --------------------------------------------------------------

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  commit(() => migrate(parsed));
}
