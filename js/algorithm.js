// algorithm.js — das Herzstück: Vorschläge nach Häufigkeit, Preis-Gedächtnis
// und laufender Saldo (Verrechnung von Über-/Unterzahlungen).
//
// Saldo-Konvention: balance > 0 => Guthaben der Person (du schuldest ihr),
//                   balance < 0 => die Person schuldet dir.

/** Summe einer Bestellung in Cent (fehlende Preise zählen als 0). */
export function orderTotal(order) {
  return order.items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0);
}

/**
 * Alle Bestellungen einer Person in chronologischer Reihenfolge.
 * Sortiert nach Fahrt-Datum, dann Reihenfolge der Fahrten, dann Position.
 */
function personOrdersChrono(state, personId) {
  const rows = [];
  state.trips.forEach((trip, tripIndex) => {
    trip.orders.forEach((order, orderIndex) => {
      if (order.personId === personId) {
        rows.push({ trip, order, tripIndex, orderIndex });
      }
    });
  });
  rows.sort(
    (a, b) =>
      a.trip.date.localeCompare(b.trip.date) ||
      a.tripIndex - b.tripIndex ||
      a.orderIndex - b.orderIndex
  );
  return rows;
}

/**
 * Was eine Bestellung dem Saldo netto hinzufügt (balanceAfter - prevBalance).
 *   - explizit erhaltener Betrag  -> effectivePaid = amountPaid
 *   - "bezahlt" angehakt          -> exakt ausgeglichen (Saldo danach 0)
 *   - sonst (offen)               -> nichts erhalten
 */
function ledgerStep(order, total, prevBalance) {
  let effectivePaid;
  if (order.amountPaid != null) {
    effectivePaid = order.amountPaid;
  } else if (order.paid) {
    effectivePaid = total - prevBalance; // gleicht exakt aus
  } else {
    effectivePaid = 0;
  }
  const balanceAfter = prevBalance - total + effectivePaid;
  return { effectivePaid, balanceAfter };
}

/** Berechnet alle Salden aus den Bestellungen neu (mutiert state). */
export function recomputeAllBalances(state) {
  state.people.forEach((person) => {
    const rows = personOrdersChrono(state, person.id);
    let balance = 0;
    for (const { order } of rows) {
      const total = orderTotal(order);
      balance = ledgerStep(order, total, balance).balanceAfter;
    }
    person.balance = balance;
  });
}

/**
 * Detaillierte Abrechnung EINER Bestellung – für die Anzeige im Bezahl-Bereich.
 * Liefert prevBalance, erwarteten Betrag (mit Verrechnung), tatsächlich
 * Erhaltenes, neuen Saldo und die Differenz dieser Runde.
 */
export function orderLedger(state, tripId, personId) {
  const rows = personOrdersChrono(state, personId);
  let prevBalance = 0;
  let target = null;
  for (const row of rows) {
    if (row.trip.id === tripId) {
      target = row;
      break;
    }
    const total = orderTotal(row.order);
    prevBalance = ledgerStep(row.order, total, prevBalance).balanceAfter;
  }
  const order = target ? target.order : null;
  const total = order ? orderTotal(order) : 0;
  const expected = total - prevBalance; // was die Person diesmal geben müsste
  const { effectivePaid, balanceAfter } = order
    ? ledgerStep(order, total, prevBalance)
    : { effectivePaid: 0, balanceAfter: prevBalance };
  const received = order && order.amountPaid != null ? order.amountPaid : null;
  // Differenz dieser Runde: positiv = zu viel, negativ = zu wenig.
  const diff = received == null ? 0 : received - expected;
  return { total, prevBalance, expected, effectivePaid, balanceAfter, received, diff };
}

/** productId -> { count, lastSeen } für eine Person. */
function personFrequency(state, personId) {
  const freq = new Map();
  for (const trip of state.trips) {
    for (const order of trip.orders) {
      if (order.personId !== personId) continue;
      for (const item of order.items) {
        const cur = freq.get(item.productId) || { count: 0, lastSeen: "" };
        cur.count += 1;
        if (trip.date > cur.lastSeen) cur.lastSeen = trip.date;
        freq.set(item.productId, cur);
      }
    }
  }
  return freq;
}

/**
 * Vorschläge beim Tippen: Produkte dieser Person nach Häufigkeit, gefiltert
 * nach `query`. Häufige Artikel der Person zuerst, dann der Rest.
 */
export function suggestProducts(state, personId, query, limit = 6) {
  const q = query.trim().toLowerCase();
  const freq = personFrequency(state, personId);
  const scored = state.products
    .map((prod) => {
      const f = freq.get(prod.id);
      return {
        prod,
        count: f?.count || 0,
        lastSeen: f?.lastSeen || "",
        matches: q === "" || prod.name.toLowerCase().includes(q),
      };
    })
    .filter((x) => x.matches);

  scored.sort(
    (a, b) =>
      b.count - a.count ||
      b.lastSeen.localeCompare(a.lastSeen) ||
      a.prod.name.localeCompare(b.prod.name, "de")
  );

  return scored.slice(0, limit).map((x) => ({
    id: x.prod.id,
    name: x.prod.name,
    lastPrice: x.prod.lastPrice,
    count: x.count,
  }));
}

/** Typische Artikel einer Person (für die Personen-Detailansicht). */
export function typicalProducts(state, personId, limit = 8) {
  return suggestProducts(state, personId, "", limit).filter((p) => p.count > 0);
}
