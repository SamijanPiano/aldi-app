// views/shared.js — wiederverwendbare Bausteine für eine Bestellung (Order):
// Artikelzeile mit Preis + Menge sowie der Bezahl-Bereich. Werden vom
// Schnell-Eintrag (entry.js) und vom Sammeleinkauf (trip.js) gemeinsam genutzt.

import { productById, changeItemQty, setItemPrice, setPayment } from "../store.js";
import { euro, euroPlain, parseEuro } from "../format.js";
import { h, icon } from "../ui.js";

/** Anzeigename eines Items: Produktname oder freier Auslagen-Text. */
export function itemName(s, item) {
  if (item.productId) return productById(item.productId, s)?.name ?? "—";
  return item.label || "—";
}

/** Zwei-Buchstaben-Initialen für den Avatar. */
export function initials(name) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

/** Kleines Saldo-Etikett (Personen-/Sammelansicht). */
export function balanceBadge(person) {
  const b = person.balance;
  if (b < 0) return h("span.badge.badge-debt", {}, `schuldet ${euro(-b)}`);
  if (b > 0) return h("span.badge.badge-credit", {}, `${euro(b)} gut`);
  return h("span.badge.badge-muted", {}, "ausgeglichen");
}

/** Kurzer Saldo-Hinweis als Text (z. B. für Vorschlagszeilen). */
export function balanceHint(person) {
  const b = person.balance;
  if (b < 0) return `schuldet ${euro(-b)}`;
  if (b > 0) return `${euro(b)} gut`;
  return undefined;
}

// ---- Artikelzeile --------------------------------------------------------

export function itemRow(s, tripId, person, item) {
  const name = itemName(s, item);
  const priceKnown = item.price != null;
  const lineTotal = (item.price ?? 0) * item.qty;

  const priceInput = h("input.price-input", {
    type: "text",
    inputmode: "decimal",
    enterkeyhint: "done",
    value: priceKnown ? euroPlain(item.price) : "",
    placeholder: "Preis",
    "aria-label": `Preis für ${name}`,
  });
  priceInput.addEventListener("change", () => {
    setItemPrice(tripId, person.id, item.id, parseEuro(priceInput.value));
  });

  return h("div.itemrow", {},
    h("div.itemrow-top", {},
      h("span.itemrow-name", {}, name),
      priceKnown
        ? h("span.itemrow-line", {}, euro(lineTotal))
        : h("span.itemrow-line.itemrow-missing", {}, "Preis fehlt")
    ),
    h("div.itemrow-bottom", {},
      h("label.price-field", {},
        priceInput,
        h("span.price-cur", {}, "€")
      ),
      qtyStepper(tripId, person, item, name)
    )
  );
}

function qtyStepper(tripId, person, item, name) {
  const qty = item.qty;
  return h("div.stepper",
    { role: "group", "aria-label": `Menge für ${name}` },
    h("button.stepper-btn",
      { "aria-label": qty <= 1 ? "Artikel entfernen" : "Menge verringern",
        onclick: () => changeItemQty(tripId, person.id, item.id, -1) },
      icon(qty <= 1 ? "trash" : "minus", 18)
    ),
    h("span.stepper-qty",
      { role: "status", "aria-live": "polite", "aria-atomic": "true",
        "aria-label": `Menge: ${qty}` },
      String(qty)
    ),
    h("button.stepper-btn",
      { "aria-label": "Menge erhöhen",
        onclick: () => changeItemQty(tripId, person.id, item.id, 1) },
      icon("plus", 18)
    )
  );
}

// ---- Bezahl-Bereich ------------------------------------------------------

export function paymentRow(tripId, person, order, ledger) {
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
    setPayment(tripId, person.id, {
      amountPaid: cents,
      paid: cents != null ? true : order.paid,
    });
  });

  const toggle = h("button.paytoggle", {
    class: settled ? "on" : undefined,
    "aria-label": "Als bezahlt markieren",
    "aria-pressed": settled ? "true" : "false",
    onclick: () => {
      if (settled) setPayment(tripId, person.id, { paid: false, amountPaid: null });
      else setPayment(tripId, person.id, { paid: true });
    },
  }, icon("check", 18), settled ? "Erhalten" : "Offen");

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
  if (order.paid) return { kind: "ok", text: "Erhalten" };
  return { kind: "open", text: "Offen" };
}
