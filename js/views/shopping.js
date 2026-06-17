// views/shopping.js — Einkaufsliste für heute: alle offenen Bestellungen
// nach Person gruppiert, Artikel der Backabteilung immer zuerst.

import { getState, personById } from "../store.js";
import { h, icon, navigate } from "../ui.js";
import { initials, itemName } from "./shared.js";

// Sitzungs-Zustand: abgehakte Artikel (Key = item.id)
const checked = new Set();

// Schlüsselwörter für die Backabteilung (case-insensitiv)
const BAKERY = [
  "brötchen", "broeichen", "croissant", "geflügelrolle", "gefluegelrolle",
  "baguette", "brezel", "laugengebäck", "laugengebaeck", "laugenstange",
  "hörnchen", "hoernchen", "butterhörnchen", "donut", "berliner", "krapfen",
  "waffel", "kuchen", "torte", "stollen", "hefezopf", "zimtschnecke",
  "mohnschnecke", "plunder", "teilchen", "striezel", "aufback", "ciabatta",
  "focaccia", "muffin", "pain au chocolat", "brot", "toast",
];

function isBakery(name) {
  const lower = name.toLowerCase();
  return BAKERY.some((k) => lower.includes(k));
}

export function renderShopping() {
  const s = getState();
  const view = h("div.view");

  view.append(
    h("header.appbar", {},
      h("button.iconbtn.ghost", { onclick: () => navigate("#/"), "aria-label": "Zurück" }, icon("back")),
      h("div.appbar-titles", {},
        h("p.appbar-eyebrow", {}, "Für heute"),
        h("h1.appbar-title", {}, "Einkaufsliste")
      )
    )
  );

  // Alle offenen Bestellungen mit mindestens einem Artikel sammeln
  const openOrders = [];
  for (const trip of s.trips) {
    for (const order of trip.orders) {
      if (order.items.length === 0) continue;
      if (order.paid || order.amountPaid != null) continue;
      const person = personById(order.personId, s);
      if (!person) continue;
      openOrders.push({ trip, order, person });
    }
  }

  if (openOrders.length === 0) {
    view.append(
      h("div.empty", {},
        h("span.empty-icon", {}, icon("list", 38)),
        h("h2", {}, "Keine offenen Bestellungen"),
        h("p", {}, `Tippe auf der Startseite auf „Eintrag“, um Bestellungen zu erfassen.`)
      )
    );
    return view;
  }

  const stack = h("div.stack");
  for (const { order, person } of openOrders) {
    stack.append(personCard(s, order, person));
  }
  view.append(stack);

  // Alle-zurücksetzen-Button
  view.append(
    h("button.shopping-reset", {
      onclick: () => { checked.clear(); rerender(); },
    }, icon("refresh", 16), " Alle Häkchen zurücksetzen")
  );

  return view;
}

function personCard(s, order, person) {
  const card = h("div.card.shopping-person");

  card.append(
    h("div.shopping-head", {},
      h("span.avatar", { "aria-hidden": "true" }, initials(person.name)),
      h("span.shopping-person-name", {}, person.name)
    )
  );

  // Backabteilung zuerst, dann Rest (innerhalb jeder Gruppe Original-Reihenfolge)
  const bakery = order.items.filter((it) => isBakery(itemName(s, it)));
  const rest   = order.items.filter((it) => !isBakery(itemName(s, it)));

  const itemsList = h("div.shopping-items");
  for (const item of [...bakery, ...rest]) {
    itemsList.append(itemRow(s, item, bakery.includes(item)));
  }
  card.append(itemsList);

  return card;
}

function itemRow(s, item, isBakeryItem) {
  const name = itemName(s, item);
  const isChecked = checked.has(item.id);

  return h("button.shopping-item", {
    class: isChecked ? "done" : undefined,
    "aria-pressed": isChecked ? "true" : "false",
    onclick: () => {
      if (checked.has(item.id)) checked.delete(item.id);
      else checked.add(item.id);
      rerender();
    },
  },
    h("span.shopping-check", { "aria-hidden": "true" },
      isChecked ? icon("check", 14) : null
    ),
    h("span.shopping-item-name", {}, name),
    item.qty > 1
      ? h("span.shopping-item-qty", {}, `×${item.qty}`)
      : null,
    isBakeryItem
      ? h("span.shopping-item-bakery", {}, "Back")
      : null
  );
}

function rerender() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
