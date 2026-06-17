// app.js — Router + Bootstrap. Hash-basiertes Routing, damit die App ohne
// Server-Konfiguration (auch als Datei) funktioniert.

import { subscribe } from "./store.js";
import { clear } from "./ui.js";
import { renderOverview } from "./views/overview.js";
import { renderEntry } from "./views/entry.js";
import { renderTrip } from "./views/trip.js";
import { renderPerson } from "./views/person.js";
import { renderSettings } from "./views/settings.js";
import { renderShopping } from "./views/shopping.js";

const root = document.getElementById("app");
let currentKey = null;

function parseRoute() {
  const hash = location.hash.replace(/^#/, "");
  const parts = hash.split("/").filter(Boolean); // "/trip/x" -> ["trip","x"]
  if (parts[0] === "entry") return { name: "entry", id: null };
  if (parts[0] === "trip" && parts[1]) return { name: "trip", id: parts[1] };
  if (parts[0] === "person" && parts[1]) return { name: "person", id: parts[1] };
  if (parts[0] === "settings") return { name: "settings", id: null };
  if (parts[0] === "shopping") return { name: "shopping", id: null };
  return { name: "overview", id: null };
}

function viewFor(route) {
  switch (route.name) {
    case "entry": return renderEntry();
    case "trip": return renderTrip(route.id);
    case "person": return renderPerson(route.id);
    case "settings": return renderSettings();
    case "shopping": return renderShopping();
    default: return renderOverview();
  }
}

function render() {
  const route = parseRoute();
  clear(root);
  root.append(viewFor(route));
  const key = route.name + (route.id || "");
  if (key !== currentKey) {
    window.scrollTo(0, 0);
    currentKey = key;
  }
}

window.addEventListener("hashchange", render);
subscribe(render); // bei jeder Datenänderung neu zeichnen
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
