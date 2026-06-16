// views/settings.js — Backup (Export/Import) und Personen-Übersicht.

import { getState, exportData, importData } from "../store.js";
import { todayIso } from "../format.js";
import { h, icon, navigate } from "../ui.js";
import { balanceBadge } from "./shared.js";

export function renderSettings() {
  const s = getState();
  const view = h("div.view");

  view.append(
    h("header.appbar", {},
      h("button.iconbtn.ghost", { onclick: () => navigate("#/"), "aria-label": "Zurück" }, icon("back")),
      h("div.appbar-titles", {},
        h("p.appbar-eyebrow", {}, "Saldo"),
        h("h1.appbar-title", {}, "Einstellungen")
      )
    )
  );

  // --- Backup ---
  view.append(
    section("Backup",
      h("p.section-hint", {},
        "iPhone-Web-Apps können ihren Speicher selten von allein leeren. Sichere deine Daten regelmäßig in eine Datei (z. B. in iCloud)."),
      h("div.btn-row", {},
        h("button.btn.btn-primary", { onclick: doExport }, icon("download", 18), "Sichern"),
        h("label.btn.btn-secondary", {},
          icon("upload", 18), "Wiederherstellen",
          importInput()
        )
      )
    )
  );

  // --- Personen ---
  const peopleBody = h("div");
  if (s.people.length === 0) {
    peopleBody.append(h("p.muted", {}, "Noch keine Personen. Sie entstehen, sobald du einen Eintrag für jemanden anlegst."));
  } else {
    const list = h("ul.cardlist");
    for (const p of [...s.people].sort((a, b) => a.name.localeCompare(b.name, "de"))) {
      list.append(
        h("li", {},
          h("button.card.personrow", { onclick: () => navigate(`#/person/${p.id}`) },
            h("span.avatar", { "aria-hidden": "true" }, p.name.trim().slice(0, 2).toUpperCase()),
            h("span.personrow-name", {}, p.name),
            balanceBadge(p)
          )
        )
      );
    }
    peopleBody.append(list);
  }
  view.append(section("Personen", peopleBody));

  view.append(
    h("p.appfoot", {}, "Alle Daten liegen nur auf diesem Gerät. Kein Konto, keine Cloud, kein Tracking.")
  );

  return view;
}

function doExport() {
  const blob = new Blob([exportData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saldo-backup-${todayIso()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB

function importInput() {
  // Visuell versteckt (sr-only) statt [hidden], damit der Datei-Dialog auch
  // per Screenreader/Tastatur über das Label auslösbar bleibt.
  const input = h("input.sr-only", { type: "file", accept: "application/json,.json" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      alert("Diese Datei ist zu groß (max. 5 MB).");
      input.value = "";
      return;
    }
    if (!confirm("Aktuelle Daten durch das Backup ersetzen?")) {
      input.value = "";
      return;
    }
    try {
      const text = await file.text();
      importData(text);
      alert("Backup wiederhergestellt.");
      navigate("#/");
    } catch (err) {
      console.error(err);
      alert("Diese Datei konnte nicht gelesen werden.");
    } finally {
      input.value = "";
    }
  });
  return input;
}

function section(title, ...body) {
  return h("section.section", {},
    h("h2.section-title", {}, title),
    ...body
  );
}
