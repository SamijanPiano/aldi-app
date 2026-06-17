// views/person.js — Personen-Detail: Saldo, typische Artikel, Bestellverlauf.

import { getState, personById, renamePerson, removePerson } from "../store.js";
import { orderTotal, typicalProducts } from "../algorithm.js";
import { euro, dateLabel } from "../format.js";
import { h, icon, navigate } from "../ui.js";

export function renderPerson(personId) {
  const s = getState();
  const person = personById(personId, s);
  if (!person) {
    navigate("#/");
    return h("div");
  }

  const view = h("div.view");

  view.append(
    h("header.appbar", {},
      h("button.iconbtn.ghost", { onclick: () => goBack(), "aria-label": "Zurück" }, icon("back")),
      h("div.appbar-titles", {},
        h("p.appbar-eyebrow", {}, "Person"),
        h("h1.appbar-title", {}, person.name)
      ),
      h("button.iconbtn.ghost",
        { "aria-label": "Umbenennen", onclick: () => rename(person) },
        icon("user")
      )
    )
  );

  view.append(balancePanel(person));

  const typical = typicalProducts(s, person.id);
  if (typical.length > 0) {
    const chips = h("div.chips");
    for (const p of typical) {
      chips.append(
        h("span.chip", {},
          h("span.chip-name", {}, p.name),
          p.lastPrice != null ? h("span.chip-price", {}, euro(p.lastPrice)) : null,
          h("span.chip-count", {}, `${p.count}×`)
        )
      );
    }
    view.append(section("Typische Artikel", chips));
  }

  view.append(section("Verlauf", historyList(s, person.id)));

  view.append(
    h("button.text-danger", {
      onclick: () => {
        if (confirm(`${person.name} und alle Bestellungen löschen?`)) {
          removePerson(person.id);
          navigate("#/");
        }
      },
    }, icon("trash", 16), "Person löschen")
  );

  return view;
}

function balancePanel(person) {
  const b = person.balance;
  let kind = "even", label = "ausgeglichen", value = euro(0);
  if (b < 0) { kind = "debt"; label = "schuldet dir noch"; value = euro(-b); }
  else if (b > 0) { kind = "credit"; label = "hat Guthaben"; value = euro(b); }

  return h("div.balance-panel", { class: `bp-${kind}` },
    h("span.balance-label", {}, label),
    h("span.balance-value", {}, value)
  );
}

function historyList(s, personId) {
  const rows = [];
  s.trips.forEach((trip) => {
    trip.orders.forEach((order) => {
      if (order.personId === personId) rows.push({ trip, order });
    });
  });
  rows.sort((a, b) => b.trip.date.localeCompare(a.trip.date));

  if (rows.length === 0) {
    return h("p.muted", {}, "Noch keine Einträge.");
  }

  const list = h("ul.cardlist");
  for (const { trip, order } of rows) {
    const total = orderTotal(order);
    const settled = order.paid || order.amountPaid != null;
    const n = order.items.length;
    const meta = n === 0 ? euro(total) : `${n} Posten · ${euro(total)}`;
    list.append(
      h("li", {},
        h("button.card.histrow", {
          onclick: () => navigate(`#/trip/${trip.id}`),
          "aria-label": `Einkauf vom ${dateLabel(trip.date)} öffnen`,
        },
          h("span.histrow-cal", {}, icon("receipt", 20)),
          h("span.histrow-main", {},
            h("strong", {}, dateLabel(trip.date)),
            h("span.muted", {}, meta)
          ),
          settled
            ? h("span.badge.badge-done", {}, icon("check", 14), "erhalten")
            : h("span.badge.badge-open", {}, "offen")
        )
      )
    );
  }
  return list;
}

function section(title, body) {
  return h("section.section", {},
    h("h2.section-title", {}, title),
    body
  );
}

function rename(person) {
  const name = prompt("Name ändern:", person.name);
  if (name && name.trim()) renamePerson(person.id, name.trim());
}

function goBack() {
  if (history.length > 1) history.back();
  else navigate("#/");
}
