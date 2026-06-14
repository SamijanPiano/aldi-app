// views/trips.js — Startseite: Liste der Einkaufsfahrten + "Neue Fahrt".

import { getState, addTrip } from "../store.js";
import { orderTotal } from "../algorithm.js";
import { euro, dateLabel, todayIso } from "../format.js";
import { h, icon, navigate } from "../ui.js";

export function renderTrips() {
  const s = getState();
  const trips = [...s.trips].sort((a, b) => b.date.localeCompare(a.date));

  const view = h("div.view");

  view.append(
    h(
      "header.appbar",
      {},
      h("div.appbar-titles", {},
        h("p.appbar-eyebrow", {}, "Aldi-Sammelbestellung"),
        h("h1.appbar-title", {}, "Deine Fahrten")
      ),
      h(
        "button.iconbtn.ghost",
        { onclick: () => navigate("#/settings"), "aria-label": "Einstellungen" },
        icon("gear")
      )
    )
  );

  view.append(
    h(
      "button.bigaction",
      {
        onclick: () => {
          const id = addTrip(todayIso());
          navigate(`#/trip/${id}`);
        },
      },
      h("span.bigaction-icon", {}, icon("plus", 26)),
      h("span.bigaction-label", {},
        h("strong", {}, "Neue Fahrt"),
        h("span.bigaction-sub", {}, "Heute zu Aldi")
      )
    )
  );

  if (trips.length === 0) {
    view.append(emptyState());
    return view;
  }

  const list = h("ul.cardlist");
  for (const trip of trips) {
    list.append(tripCard(trip));
  }
  view.append(list);
  return view;
}

function tripCard(trip) {
  const total = trip.orders.reduce((sum, o) => sum + orderTotal(o), 0);
  const people = trip.orders.length;
  const open = trip.orders.filter((o) => !o.paid && o.amountPaid == null).length;

  return h(
    "li",
    {},
    h(
      "button.card.tripcard",
      { onclick: () => navigate(`#/trip/${trip.id}`) },
      h("span.tripcard-cal", {}, icon("calendar", 22)),
      h("span.tripcard-main", {},
        h("strong.tripcard-date", {}, dateLabel(trip.date)),
        h("span.tripcard-meta", {},
          `${people} ${people === 1 ? "Person" : "Personen"} · ${euro(total)}`
        )
      ),
      open > 0
        ? h("span.badge.badge-open", {}, `${open} offen`)
        : people > 0
          ? h("span.badge.badge-done", {}, icon("check", 14), "fertig")
          : h("span.badge.badge-muted", {}, "leer")
    )
  );
}

function emptyState() {
  return h(
    "div.empty",
    {},
    h("span.empty-icon", {}, icon("cart", 40)),
    h("h2", {}, "Noch keine Fahrten"),
    h("p", {}, "Tippe auf „Neue Fahrt“, wenn du das nächste Mal für deine Leute zu Aldi fährst.")
  );
}
