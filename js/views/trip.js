// views/trip.js — das Cockpit einer Einkaufsfahrt: Personen, Artikel, Bezahlung.

import {
  getState, tripById, personById, productById,
  addPerson, addPersonToTrip, removeOrder, removeTrip,
  addItem, changeItemQty, setItemPrice, setPayment,
} from "../store.js";
import { orderTotal, orderLedger, suggestProducts } from "../algorithm.js";
import { euro, euroPlain, parseEuro, dateLabel } from "../format.js";
import { h, icon, navigate } from "../ui.js";
import { autocompleteInput } from "./autocomplete.js";

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
        h("p.appbar-eyebrow", {}, "Einkaufsfahrt"),
        h("h1.appbar-title", {}, dateLabel(trip.date))
      ),
      h(
        "button.iconbtn.ghost.danger",
        {
          "aria-label": "Fahrt löschen",
          onclick: () => {
            if (confirm("Diese Fahrt wirklich löschen?")) {
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
        h("span.trip-summary-label", {}, "Summe diese Fahrt"),
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
        { "aria-label": "Person aus Fahrt entfernen",
          onclick: () => {
            if (confirm(`${person.name} aus dieser Fahrt entfernen?`)) {
              removeOrder(trip.id, person.id);
            }
          } },
        icon("trash", 18)
      )
    )
  );

  const items = h("div.items");
  order.items.forEach((item) => {
    items.append(itemRow(s, trip, person, item));
  });
  if (order.items.length === 0) {
    items.append(h("p.items-empty", {}, "Noch keine Artikel."));
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

  card.append(paymentRow(trip, person, order, ledger));
  return card;
}

function itemRow(s, trip, person, item) {
  const prod = productById(item.productId, s);
  const priceKnown = item.price != null;
  const lineTotal = (item.price ?? 0) * item.qty;

  const priceInput = h("input.price-input", {
    type: "text",
    inputmode: "decimal",
    enterkeyhint: "done",
    value: priceKnown ? euroPlain(item.price) : "",
    placeholder: "Preis",
    "aria-label": `Preis für ${prod?.name ?? "Artikel"}`,
  });
  priceInput.addEventListener("change", () => {
    setItemPrice(trip.id, person.id, item.id, parseEuro(priceInput.value));
  });

  return h("div.itemrow", {},
    h("div.itemrow-top", {},
      h("span.itemrow-name", {}, prod?.name ?? "—"),
      priceKnown
        ? h("span.itemrow-line", {}, euro(lineTotal))
        : h("span.itemrow-line.itemrow-missing", {}, "Preis fehlt")
    ),
    h("div.itemrow-bottom", {},
      h("label.price-field", {},
        priceInput,
        h("span.price-cur", {}, "€")
      ),
      qtyStepper(trip, person, item, prod)
    )
  );
}

function qtyStepper(trip, person, item, prod) {
  const qty = item.qty;
  return h("div.stepper",
    { role: "group", "aria-label": `Menge für ${prod?.name ?? "Artikel"}` },
    h("button.stepper-btn",
      { "aria-label": qty <= 1 ? "Artikel entfernen" : "Menge verringern",
        onclick: () => changeItemQty(trip.id, person.id, item.id, -1) },
      icon(qty <= 1 ? "trash" : "minus", 18)
    ),
    h("span.stepper-qty",
      { role: "status", "aria-live": "polite", "aria-atomic": "true",
        "aria-label": `Menge: ${qty}` },
      String(qty)
    ),
    h("button.stepper-btn",
      { "aria-label": "Menge erhöhen",
        onclick: () => changeItemQty(trip.id, person.id, item.id, 1) },
      icon("plus", 18)
    )
  );
}

// ---- Bezahlung -----------------------------------------------------------

function paymentRow(trip, person, order, ledger) {
  const settled = order.paid || order.amountPaid != null;
  const status = paymentStatus(order, ledger);

  const received = h("input.pay-input", {
    type: "text",
    inputmode: "decimal",
    enterkeyhint: "done",
    value: order.amountPaid != null ? euroPlain(order.amountPaid) : "",
    placeholder: euroPlain(Math.max(ledger.expected, 0)),
    "aria-label": "Erhaltener Betrag",
  });
  received.addEventListener("change", () => {
    const cents = parseEuro(received.value);
    setPayment(trip.id, person.id, {
      amountPaid: cents,
      paid: cents != null ? true : order.paid,
    });
  });

  const toggle = h("button.paytoggle", {
    class: settled ? "on" : undefined,
    "aria-label": "Als bezahlt markieren",
    "aria-pressed": settled ? "true" : "false",
    onclick: () => {
      if (settled) setPayment(trip.id, person.id, { paid: false, amountPaid: null });
      else setPayment(trip.id, person.id, { paid: true });
    },
  }, icon("check", 18), settled ? "Bezahlt" : "Offen");

  const carry = ledger.prevBalance !== 0
    ? h("p.pay-carry", {},
        ledger.prevBalance > 0
          ? `${euro(ledger.prevBalance)} Guthaben verrechnet → `
          : `${euro(-ledger.prevBalance)} Altschuld → `,
        h("strong", {}, `zu zahlen ${euro(Math.max(ledger.expected, 0))}`))
    : null;

  return h("div.pay", {},
    carry,
    h("div.pay-controls", {},
      h("label.pay-field", {},
        h("span.pay-cur", {}, "€"),
        received
      ),
      toggle
    ),
    h("div.pay-status", { class: `status-${status.kind}` },
      h("span.status-dot", { "aria-hidden": "true" }),
      status.text
    )
  );
}

function paymentStatus(order, ledger) {
  if (order.amountPaid != null) {
    if (ledger.diff > 0) return { kind: "over", text: `${euro(ledger.diff)} zu viel` };
    if (ledger.diff < 0) return { kind: "under", text: `${euro(-ledger.diff)} zu wenig` };
    return { kind: "ok", text: "Passt genau" };
  }
  if (order.paid) return { kind: "ok", text: "Bezahlt" };
  return { kind: "open", text: "Offen" };
}

// ---- Person hinzufügen ---------------------------------------------------

function addPersonRow(s, trip) {
  const inTrip = new Set(trip.orders.map((o) => o.personId));
  const available = s.people.filter((p) => !inTrip.has(p.id));

  const ac = autocompleteInput({
    placeholder: "Person hinzufügen …",
    ariaLabel: "Person zur Fahrt hinzufügen",
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

// ---- kleine Helfer -------------------------------------------------------

function balanceBadge(person) {
  const b = person.balance;
  if (b < 0) return h("span.badge.badge-debt", {}, `schuldet ${euro(-b)}`);
  if (b > 0) return h("span.badge.badge-credit", {}, `${euro(b)} gut`);
  return h("span.badge.badge-muted", {}, "ausgeglichen");
}

function balanceHint(person) {
  const b = person.balance;
  if (b < 0) return `schuldet ${euro(-b)}`;
  if (b > 0) return `${euro(b)} gut`;
  return undefined;
}

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}
