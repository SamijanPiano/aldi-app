import { test } from "node:test";
import assert from "node:assert/strict";
import {
  orderTotal,
  recomputeAllBalances,
  orderLedger,
  suggestProducts,
} from "../js/algorithm.js";
import { parseEuro, euro } from "../js/format.js";

// Hilfsfunktion: minimaler State-Builder.
function state({ people = [], products = [], trips = [] } = {}) {
  return { version: 1, people, products, trips };
}

test("orderTotal summiert Stückpreis × Menge, null = 0", () => {
  const order = { items: [
    { productId: "a", qty: 2, price: 149 },
    { productId: "b", qty: 1, price: null },
    { productId: "c", qty: 3, price: 100 },
  ] };
  assert.equal(orderTotal(order), 149 * 2 + 0 + 100 * 3);
});

test("offene Bestellung: Saldo = -Summe (Person schuldet)", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    trips: [{ id: "t1", date: "2026-06-01", orders: [
      { personId: "p1", items: [{ productId: "x", qty: 1, price: 1000 }], paid: false, amountPaid: null },
    ] }],
  });
  recomputeAllBalances(s);
  assert.equal(s.people[0].balance, -1000);
});

test("'bezahlt' angehakt gleicht exakt aus (Saldo 0)", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    trips: [{ id: "t1", date: "2026-06-01", orders: [
      { personId: "p1", items: [{ productId: "x", qty: 1, price: 1000 }], paid: true, amountPaid: null },
    ] }],
  });
  recomputeAllBalances(s);
  assert.equal(s.people[0].balance, 0);
});

test("Überzahlung erzeugt Guthaben", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    trips: [{ id: "t1", date: "2026-06-01", orders: [
      { personId: "p1", items: [{ productId: "x", qty: 1, price: 1000 }], paid: true, amountPaid: 1200 },
    ] }],
  });
  recomputeAllBalances(s);
  assert.equal(s.people[0].balance, 200); // 2 € Guthaben
  const l = orderLedger(s, "t1", "p1");
  assert.equal(l.diff, 200); // 2 € zu viel
});

test("Guthaben wird beim nächsten Einkauf verrechnet", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    trips: [
      { id: "t1", date: "2026-06-01", orders: [
        { personId: "p1", items: [{ productId: "x", qty: 1, price: 1000 }], paid: true, amountPaid: 1200 },
      ] },
      { id: "t2", date: "2026-06-08", orders: [
        { personId: "p1", items: [{ productId: "y", qty: 1, price: 800 }], paid: true, amountPaid: null },
      ] },
    ],
  });
  recomputeAllBalances(s);
  // t1 -> +200 Guthaben, t2 "bezahlt" gleicht mit Verrechnung aus -> 0
  assert.equal(s.people[0].balance, 0);
  const l2 = orderLedger(s, "t2", "p1");
  assert.equal(l2.prevBalance, 200);
  assert.equal(l2.expected, 600); // 8 € - 2 € Guthaben
});

test("Unterzahlung mit vorhandenem Guthaben", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    trips: [
      { id: "t1", date: "2026-06-01", orders: [
        { personId: "p1", items: [{ productId: "x", qty: 1, price: 1000 }], paid: true, amountPaid: 1200 },
      ] },
      { id: "t2", date: "2026-06-08", orders: [
        { personId: "p1", items: [{ productId: "y", qty: 1, price: 800 }], paid: false, amountPaid: 500 },
      ] },
    ],
  });
  recomputeAllBalances(s);
  // prevBalance +200, total 800, paid 500 -> 200 - 800 + 500 = -100 (schuldet 1 €)
  assert.equal(s.people[0].balance, -100);
  const l2 = orderLedger(s, "t2", "p1");
  assert.equal(l2.expected, 600);
  assert.equal(l2.diff, -100); // 1 € zu wenig
});

test("Reihenfolge folgt dem Datum, nicht der Array-Position", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    trips: [
      { id: "tLate", date: "2026-06-20", orders: [
        { personId: "p1", items: [{ productId: "y", qty: 1, price: 500 }], paid: false, amountPaid: null },
      ] },
      { id: "tEarly", date: "2026-06-01", orders: [
        { personId: "p1", items: [{ productId: "x", qty: 1, price: 1000 }], paid: true, amountPaid: 1200 },
      ] },
    ],
  });
  recomputeAllBalances(s);
  // chronologisch: early (+200), dann late (offen, -500) -> 200 - 500 = -300
  assert.equal(s.people[0].balance, -300);
  const lLate = orderLedger(s, "tLate", "p1");
  assert.equal(lLate.prevBalance, 200);
});

test("Vorschläge sortieren nach Häufigkeit pro Person", () => {
  const s = state({
    people: [{ id: "p1", name: "A", balance: 0 }],
    products: [
      { id: "milk", name: "Milch", lastPrice: 109 },
      { id: "bread", name: "Brot", lastPrice: 159 },
      { id: "eggs", name: "Eier", lastPrice: 199 },
    ],
    trips: [
      { id: "t1", date: "2026-06-01", orders: [
        { personId: "p1", items: [{ productId: "milk", qty: 1, price: 109 }, { productId: "bread", qty: 1, price: 159 }], paid: true, amountPaid: null },
      ] },
      { id: "t2", date: "2026-06-08", orders: [
        { personId: "p1", items: [{ productId: "milk", qty: 1, price: 109 }], paid: true, amountPaid: null },
      ] },
    ],
  });
  const sugg = suggestProducts(s, "p1", "");
  assert.equal(sugg[0].name, "Milch"); // 2×
  assert.equal(sugg[0].count, 2);
  assert.equal(sugg[1].name, "Brot"); // 1×
  // Filter nach Tippen
  const filtered = suggestProducts(s, "p1", "ei");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, "Eier");
});

test("parseEuro versteht Komma, Punkt und Teilangaben", () => {
  assert.equal(parseEuro("1,49"), 149);
  assert.equal(parseEuro("1.49"), 149);
  assert.equal(parseEuro("2"), 200);
  assert.equal(parseEuro("1,5"), 150);
  assert.equal(parseEuro("12,99"), 1299);
  assert.equal(parseEuro("0,99 €"), 99);
  assert.equal(parseEuro(""), null);
  assert.equal(parseEuro("abc"), null);
});

test("parseEuro behandelt deutsche Tausendertrennzeichen korrekt", () => {
  assert.equal(parseEuro("1.000,49"), 100049);
  assert.equal(parseEuro("1.000"), 100000);
  assert.equal(parseEuro("10.000,00"), 1000000);
});

test("euro formatiert Cent als deutsche Währung", () => {
  assert.match(euro(149), /1,49/);
  assert.match(euro(0), /0,00/);
});
