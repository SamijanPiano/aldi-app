// views/trip.js — Sammeleinkauf: für mehrere Personen auf einmal. Pro Person
// eine Karte mit Artikeln, Preisen und Bezahlung. Der Schnell-Eintrag für eine
// einzelne Person liegt in entry.js; beide teilen sich shared.js.

import {
  getState, tripById, personById,
  addPerson, addPersonToTrip, removeOrder, removeTrip, addItem,
} from "../store.js";
import { orderTotal, orderLedger, suggestProducts } from "../algorithm.js";
import { euro, dateLabel } from "../format.js";
import { h, icon, navigate } from "../ui.js";
import { autocompleteInput } from "./autocomplete.js";
import { itemRow, paymentRow, initials, balanceBadge, balanceHint } from "./shared.js";

// Welche "Artikel hinzufügen"-Eingabe nach dem nächsten Render fokussiert wird.
let focusAddFor = null;

export function renderTrip(tripId) {
  const s = getState();
  const trip = tripById(tripId, s);
  if (!trip) {
    navigate("#/");
    return h("div");
  }

  const view = h("div.view");
  const total = trip.orders.reduce((sum, o) => sum + orderTotal(o), 0);

  view.append(
    h(
      "header.appbar",
      {},
      h("button.iconbtn.ghost", { onclick: () => navigate("#/"), "aria-label": "Zurück" }, icon("back")),
      h("div.appbar-titles", {},
        h("p.appbar-eyebrow", {}, "Sammeleinkauf"),
        h("h1.appbar-title", {}, dateLabel(trip.date))
      ),
      h(
        "button.iconbtn.ghost.danger",
        {
          "aria-label": "Einkauf löschen",
          onclick: () => {
            if (confirm("Diesen Einkauf wirklich löschen?")) {
              removeTrip(trip.id);
              navigate("#/");
            }
          },
        },
        icon("trash")
      )
    )
  );

  if (trip.orders.length > 0) {
    view.append(
      h("div.trip-summary", {},
        h("span.trip-summary-label", {}, "Summe"),
        h("span.trip-summary-value", {}, euro(total))
      )
    );
  }

  const stack = h("div.stack");
  for (const order of trip.orders) {
    stack.append(personCard(s, trip, order));
  }
  view.append(stack);

  view.append(addPersonRow(s, trip));

  if (focusAddFor) {
    const target = focusAddFor;
    focusAddFor = null;
    requestAnimationFrame(() => {
      view.querySelector(`.ac[data-add-for="${target}"] .ac-input`)?.focus();
    });
  }

  return view;
}

// ---- Personen-Karte ------------------------------------------------------

function personCard(s, trip, order) {
  const person = personById(order.personId, s);
  if (!person) return h("div");
  const ledger = orderLedger(s, trip.id, person.id);

  const card = h("div.card.person");

  card.append(
    h("div.person-head", {},
      h("button.person-id",
        { onclick: () => navigate(`#/person/${person.id}`),
          "aria-label": `${person.name} — Details öffnen` },
        h("span.avatar", { "aria-hidden": "true" }, initials(person.name)),
        h("span.person-name", {}, person.name)
      ),
      balanceBadge(person),
      h("button.iconbtn.ghost.tiny.danger",
        { "aria-label": "Person aus Einkauf entfernen",
          onclick: () => {
            if (confirm(`${person.name} aus diesem Einkauf entfernen?`)) {
              removeOrder(trip.id, person.id);
            }
          } },
        icon("trash", 18)
      )
    )
  );

  const items = h("div.items");
  order.items.forEach((item) => {
    items.append(itemRow(s, trip.id, person, item));
  });
  if (order.items.length === 0) {
    items.append(h("p.items-empty", {}, "Noch nichts erfasst."));
  }
  card.append(items);

  const ac = autocompleteInput({
    placeholder: "Artikel hinzufügen …",
    ariaLabel: `Artikel für ${person.name} hinzufügen`,
    listLabel: "Artikel-Vorschläge",
    getSuggestions: (q) =>
      suggestProducts(s, person.id, q).map((p) => ({
        id: p.id,
        name: p.name,
        hint: p.lastPrice != null ? euro(p.lastPrice) : undefined,
      })),
    createLabel: (q) => `„${q}“ hinzufügen`,
    onPick: ({ name }) => {
      focusAddFor = person.id;
      addItem(trip.id, person.id, name, null, 1);
    },
  });
  ac.el.dataset.addFor = person.id;
  card.append(ac.el);

  card.append(paymentRow(trip.id, person, order, ledger));
  return card;
}

// ---- Person hinzufügen ---------------------------------------------------

function addPersonRow(s, trip) {
  const inTrip = new Set(trip.orders.map((o) => o.personId));
  const available = s.people.filter((p) => !inTrip.has(p.id));

  const ac = autocompleteInput({
    placeholder: "Person hinzufügen …",
    ariaLabel: "Person zum Einkauf hinzufügen",
    listLabel: "Personen-Vorschläge",
    getSuggestions: (q) =>
      available
        .filter((p) => q === "" || p.name.toLowerCase().includes(q.toLowerCase()))
        .map((p) => ({ id: p.id, name: p.name, hint: balanceHint(p) })),
    createLabel: (q) => `„${q}“ neu anlegen`,
    onPick: ({ name, id, isNew }) => {
      const pid = isNew || !id ? addPerson(name) : id;
      addPersonToTrip(trip.id, pid);
    },
  });
  ac.el.classList.add("ac-person");
  return h("div.addperson", {},
    h("span.addperson-icon", {}, icon("user", 20)),
    ac.el
  );
}
