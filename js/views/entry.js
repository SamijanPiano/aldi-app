// views/entry.js — Schnell-Eintrag für EINE Person: „Für [Person] [Sache]
// gekauft". Zwei Modi: Artikel (mit Vorschlägen + Preisgedächtnis) oder Betrag
// (einmalige Auslage, freier Text). Für mehrere Personen auf einmal: trip.js.

import {
  getState, tripById, personById,
  addPerson, addTrip, addPersonToTrip, addItem, addFreeItem,
  removeTrip, setTripDate,
} from "../store.js";
import { orderLedger, suggestProducts } from "../algorithm.js";
import { euro, parseEuro, todayIso } from "../format.js";
import { h, icon, navigate } from "../ui.js";
import { autocompleteInput } from "./autocomplete.js";
import { itemRow, paymentRow, initials } from "./shared.js";

// Transienter Zustand über Re-Renders hinweg (wie focusAddFor in trip.js).
let entry = null;      // { tripId, personId } sobald eine Person gewählt ist
let mode = "item";     // "item" | "amount"
let focusAdd = false;
let isResuming = false; // true wenn eine bestehende offene Bestellung weitergeführt wird

/** Vom „Eintrag"-Button der Übersicht: immer frisch beginnen. */
export function beginEntry() {
  cleanupIfEmpty();
  entry = null;
  mode = "item";
  isResuming = false;
}

function cleanupIfEmpty() {
  if (!entry) return;
  const trip = tripById(entry.tripId);
  const order = trip?.orders.find((o) => o.personId === entry.personId);
  if (trip && (!order || order.items.length === 0)) removeTrip(trip.id);
  entry = null;
}

function leave() {
  cleanupIfEmpty();
  mode = "item";
  isResuming = false;
  navigate("#/");
}

function done() {
  entry = null;
  mode = "item";
  isResuming = false;
  navigate("#/");
}

export function renderEntry() {
  const s = getState();

  // Verwaisten Zeiger abfangen (z. B. nach Backup-Wiederherstellung).
  if (entry && !tripById(entry.tripId, s)) entry = null;

  const view = h("div.view");
  view.append(
    h("header.appbar", {},
      h("button.iconbtn.ghost", { onclick: leave, "aria-label": "Zurück" }, icon("back")),
      h("div.appbar-titles", {}, h("h1.appbar-title", {}, isResuming ? "Bestellung bearbeiten" : "Neuer Eintrag"))
    )
  );

  view.append(entry ? form(s) : personPicker(s));
  return view;
}

// ---- Schritt 1: Person wählen --------------------------------------------

function personPicker(s) {
  const people = [...s.people].sort((a, b) => a.name.localeCompare(b.name, "de"));

  const ac = autocompleteInput({
    placeholder: "Für wen? Name eingeben …",
    ariaLabel: "Person wählen",
    listLabel: "Personen",
    getSuggestions: (q) =>
      people
        .filter((p) => q === "" || p.name.toLowerCase().includes(q.toLowerCase()))
        .map((p) => ({ id: p.id, name: p.name })),
    createLabel: (q) => `„${q}“ neu anlegen`,
    onPick: ({ name, id, isNew }) => {
      const pid = isNew || !id ? addPerson(name) : id;
      const today = todayIso();

      // Für bestehende Personen: offene Bestellung von heute weitermachen statt
      // einen neuen Trip anzulegen. Verhindert doppelte Einträge am gleichen Tag.
      if (!isNew && id) {
        const s = getState();
        let resumed = null;
        for (let i = s.trips.length - 1; i >= 0; i--) {
          const t = s.trips[i];
          if (t.date !== today) continue;
          const ord = t.orders.find((o) => o.personId === pid && !o.paid && o.amountPaid == null);
          if (ord) { resumed = t; break; }
        }
        if (resumed) {
          entry = { tripId: resumed.id, personId: pid };
          mode = "item";
          focusAdd = true;
          isResuming = true;
          rerender();
          return;
        }
      }

      isResuming = false;
      const tid = addTrip(today);
      entry = { tripId: tid, personId: pid };
      mode = "item";
      focusAdd = true;
      addPersonToTrip(tid, pid); // letzter Commit -> Re-Render zeigt das Formular
    },
  });

  return h("div.pick", {},
    h("p.pick-label", {}, "Für wen hast du etwas gekauft?"),
    h("div.addperson", {},
      h("span.addperson-icon", {}, icon("user", 20)),
      ac.el
    )
  );
}

// ---- Schritt 2: Eintrag erfassen -----------------------------------------

function form(s) {
  const trip = tripById(entry.tripId, s);
  const person = personById(entry.personId, s);
  if (!trip || !person) { entry = null; return personPicker(s); }
  const order = trip.orders.find((o) => o.personId === person.id);
  const ledger = orderLedger(s, trip.id, person.id);

  const wrap = h("div.stack");

  // Person + Datum
  wrap.append(
    h("div.card.entry-head", {},
      h("button.person-id",
        { onclick: () => navigate(`#/person/${person.id}`),
          "aria-label": `${person.name} — Details öffnen` },
        h("span.avatar", { "aria-hidden": "true" }, initials(person.name)),
        h("span.person-name", {}, person.name)
      ),
      dateField(trip)
    )
  );

  // erfasste Posten
  const items = h("div.card.entry-items");
  if (order.items.length === 0) {
    items.append(h("p.items-empty", {}, "Noch nichts erfasst."));
  } else {
    order.items.forEach((item) => items.append(itemRow(s, trip.id, person, item)));
  }
  wrap.append(items);

  // Modus-Umschalter + passendes Eingabefeld
  wrap.append(modeSwitch());
  wrap.append(mode === "item" ? itemAdder(s, trip, person) : amountAdder(trip, person));

  // Bezahlung + Abschluss
  wrap.append(h("div.card.entry-pay", {}, paymentRow(trip.id, person, order, ledger)));
  wrap.append(
    h("button.btn.btn-primary.entry-done", { onclick: done },
      icon("check", 18), "Fertig")
  );

  if (focusAdd) {
    focusAdd = false;
    requestAnimationFrame(() => wrap.querySelector(".ac .ac-input, .amount-label")?.focus());
  }

  return wrap;
}

function dateField(trip) {
  const input = h("input.date-input", {
    type: "date",
    value: trip.date,
    max: todayIso(),
    "aria-label": "Datum des Eintrags",
  });
  input.addEventListener("change", () => {
    if (input.value) setTripDate(trip.id, input.value);
  });
  return h("label.date-field", {}, icon("calendar", 18), input);
}

function modeSwitch() {
  const seg = (m, label) =>
    h("button.segmented-btn", {
      class: mode === m ? "on" : undefined,
      "aria-pressed": mode === m ? "true" : "false",
      onclick: () => { mode = m; focusAdd = true; rerender(); },
    }, label);
  return h("div.segmented", { role: "group", "aria-label": "Art des Eintrags" },
    seg("item", "Artikel"),
    seg("amount", "Betrag")
  );
}

function itemAdder(s, trip, person) {
  const ac = autocompleteInput({
    placeholder: "Artikel hinzufügen …",
    ariaLabel: `Artikel für ${person.name}`,
    listLabel: "Artikel-Vorschläge",
    getSuggestions: (q) =>
      suggestProducts(s, person.id, q).map((p) => ({
        id: p.id,
        name: p.name,
        hint: p.lastPrice != null ? euro(p.lastPrice) : undefined,
      })),
    createLabel: (q) => `„${q}“ hinzufügen`,
    onPick: ({ name }) => { focusAdd = true; addItem(trip.id, person.id, name, null, 1); },
  });
  return h("div.adder", {}, ac.el);
}

function amountAdder(trip, person) {
  const label = h("input.amount-label", {
    type: "text",
    placeholder: "Wofür? z. B. Konzertticket",
    "aria-label": "Bezeichnung der Auslage",
    enterkeyhint: "next",
    autocapitalize: "sentences",
  });
  const price = h("input.amount-price", {
    type: "text",
    inputmode: "decimal",
    placeholder: "0,00",
    "aria-label": "Betrag in Euro",
    enterkeyhint: "done",
  });

  function submit() {
    const text = label.value.trim();
    if (!text) { label.focus(); return; }
    addFreeItem(trip.id, person.id, text, parseEuro(price.value));
    focusAdd = true;
  }
  price.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  label.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); price.focus(); } });

  return h("div.adder.amount-adder", {},
    label,
    h("label.amount-field", {}, h("span.price-cur", {}, "€"), price),
    h("button.btn.btn-secondary.amount-add", { onclick: submit },
      icon("plus", 18), "Hinzufügen")
  );
}

// Re-Render anstoßen, ohne den Store zu verändern (für reinen UI-Zustand).
function rerender() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
