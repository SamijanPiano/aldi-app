// views/overview.js — Startseite: Kontostand-Übersicht. Oben die Summe, die
// dir geschuldet wird, darunter die Personen nach Saldo sortiert (wer dir am
// meisten schuldet zuerst). Primäraktion: ein neuer Eintrag.

import { getState, addTrip } from "../store.js";
import { euro, todayIso, dateLabel } from "../format.js";
import { h, icon, navigate } from "../ui.js";
import { initials, itemName } from "./shared.js";
import { beginEntry } from "./entry.js";

export function renderOverview() {
  const s = getState();
  const view = h("div.view");

  view.append(
    h("header.appbar", {},
      h("div.appbar-titles", {}, h("h1.appbar-title", {}, "Saldo")),
      h("button.iconbtn.ghost",
        { onclick: () => navigate("#/settings"), "aria-label": "Einstellungen" },
        icon("gear")
      )
    )
  );

  view.append(summaryCard(s));
  view.append(actions());

  const people = peopleWithActivity(s).sort(
    (a, b) => a.balance - b.balance || a.name.localeCompare(b.name, "de")
  );

  if (people.length === 0) {
    view.append(emptyState());
    return view;
  }

  view.append(h("h2.section-title.overview-heading", {}, "Personen"));
  const list = h("ul.cardlist");
  for (const p of people) list.append(balanceRow(s, p));
  view.append(list);

  return view;
}

// ---- Summe oben ----------------------------------------------------------

function summaryCard(s) {
  let owedToYou = 0;
  let youOwe = 0;
  for (const p of s.people) {
    if (p.balance < 0) owedToYou += -p.balance;
    else if (p.balance > 0) youOwe += p.balance;
  }

  const value = owedToYou > 0
    ? h("span.summary-value.amt-pos", {}, euro(owedToYou))
    : h("span.summary-value.amt-zero", {}, euro(0));

  const sub = youOwe > 0
    ? h("p.summary-sub.amt-neg", {}, `Du schuldest ${euro(youOwe)}`)
    : owedToYou === 0
      ? h("p.summary-sub", {}, "Alles ausgeglichen.")
      : null;

  return h("div.summary", {},
    h("p.summary-label", {}, "Dir wird geschuldet"),
    value,
    sub
  );
}

// ---- Aktionen ------------------------------------------------------------

function actions() {
  return h("div.actions", {},
    h("button.action-primary", { onclick: () => { beginEntry(); navigate("#/entry"); } },
      icon("plus", 20),
      h("span", {}, "Eintrag")
    ),
    h("button.linkbtn", {
      onclick: () => {
        const id = addTrip(todayIso());
        navigate(`#/trip/${id}`);
      },
    }, "Mehrere auf einmal")
  );
}

// ---- Personenzeile -------------------------------------------------------

function balanceRow(s, person) {
  const b = person.balance;
  let amount, kind, label;
  if (b < 0) { amount = euro(-b); kind = "amt-pos"; label = "schuldet dir"; }
  else if (b > 0) { amount = euro(b); kind = "amt-neg"; label = "du schuldest"; }
  else { amount = "ausgeglichen"; kind = "amt-zero"; label = null; }

  return h("li", {},
    h("button.card.balrow", {
      onclick: () => navigate(`#/person/${person.id}`),
      "aria-label": `${person.name}, ${label ? `${label} ${amount}` : amount}`,
    },
      h("span.avatar", { "aria-hidden": "true" }, initials(person.name)),
      h("span.balrow-main", {},
        h("span.balrow-name", {}, person.name),
        h("span.balrow-sub", {}, subline(s, person.id))
      ),
      h("span.balrow-amount", {},
        h("span.balrow-value", { class: kind }, amount),
        label ? h("span.balrow-amount-sub", {}, label) : null
      )
    )
  );
}

/** Kurze Zweitzeile: jüngster Eintrag (Artikel/Auslagen oder Datum). */
function subline(s, personId) {
  const rows = [];
  for (const trip of s.trips) {
    for (const order of trip.orders) {
      if (order.personId === personId) rows.push({ trip, order });
    }
  }
  if (rows.length === 0) return "Noch keine Einträge";
  rows.sort((a, b) => b.trip.date.localeCompare(a.trip.date));

  const latest = rows.find((r) => r.order.items.length > 0) || rows[0];
  const items = latest.order.items;
  if (items.length === 0) return dateLabel(latest.trip.date);

  const names = items.slice(0, 3).map((it) => itemName(s, it));
  let text = names.join(", ");
  if (items.length > 3) text += " …";
  return text;
}

// ---- Hilfen --------------------------------------------------------------

/** Personen mit Saldo ≠ 0 oder mit mindestens einem Eintrag. */
function peopleWithActivity(s) {
  const active = new Set();
  for (const trip of s.trips) {
    for (const order of trip.orders) active.add(order.personId);
  }
  return s.people.filter((p) => p.balance !== 0 || active.has(p.id));
}

function emptyState() {
  return h("div.empty", {},
    h("span.empty-icon", {}, icon("receipt", 38)),
    h("h2", {}, "Noch nichts erfasst"),
    h("p", {}, "Tippe auf „Eintrag“, sobald du das nächste Mal etwas für jemanden auslegst.")
  );
}
