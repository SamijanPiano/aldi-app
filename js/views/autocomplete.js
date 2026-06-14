// views/autocomplete.js — wiederverwendbare Tipp-mit-Vorschlägen-Eingabe.
// Wird sowohl für Artikel (Häufigkeit pro Person) als auch zum Hinzufügen
// von Personen genutzt. Aktualisiert das Popover direkt im DOM, damit beim
// Tippen kein Re-Render und kein Fokusverlust passiert.
//
// Barrierefrei als ARIA-Combobox umgesetzt: aria-expanded/-controls/
// -activedescendant am Input, role=listbox/option, Pfeiltasten-Navigation.

import { h, icon } from "../ui.js";

let acSeq = 0;

/**
 * @param {object} cfg
 * @param {string} cfg.placeholder
 * @param {string} [cfg.ariaLabel]   barrierefreier Name des Felds
 * @param {string} [cfg.listLabel]   Name der Vorschlagsliste
 * @param {(q:string)=>Array<{id?:string,name:string,hint?:string}>} cfg.getSuggestions
 * @param {(pick:{name:string,id:string|null,isNew:boolean})=>void} cfg.onPick
 * @param {boolean} [cfg.allowCreate=true]
 * @param {(name:string)=>string} [cfg.createLabel]
 * @returns {{el:HTMLElement, focus:()=>void}}
 */
export function autocompleteInput(cfg) {
  const allowCreate = cfg.allowCreate !== false;
  const listId = `ac-list-${++acSeq}`;
  const label = cfg.ariaLabel || cfg.placeholder || "Eingabe";

  const list = h("ul.ac-list", { id: listId, role: "listbox", "aria-label": cfg.listLabel || "Vorschläge" });
  const input = h("input.ac-input", {
    type: "text",
    role: "combobox",
    placeholder: cfg.placeholder || "",
    "aria-label": label,
    "aria-expanded": "false",
    "aria-autocomplete": "list",
    "aria-haspopup": "listbox",
    "aria-controls": listId,
    autocomplete: "off",
    autocapitalize: "words",
    spellcheck: "false",
    enterkeyhint: "done",
  });
  const wrap = h("div.ac", {}, input, list);

  function close() {
    list.replaceChildren();
    wrap.classList.remove("open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function pick(p) {
    cfg.onPick(p);
    input.value = "";
    close();
    // Fokus halten, damit der nächste Artikel sofort getippt werden kann.
    requestAnimationFrame(() => input.focus());
  }

  function options() {
    return [...list.querySelectorAll(".ac-item")];
  }

  function setActive(el) {
    options().forEach((o) => {
      o.classList.remove("active");
      o.setAttribute("aria-selected", "false");
    });
    if (el) {
      el.classList.add("active");
      el.setAttribute("aria-selected", "true");
      input.setAttribute("aria-activedescendant", el.id);
      el.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function refresh() {
    const q = input.value.trim();
    const items = cfg.getSuggestions(q) || [];
    const exact = items.some((s) => s.name.toLowerCase() === q.toLowerCase());
    list.replaceChildren();

    items.forEach((s, i) => {
      list.append(
        h(
          "li.ac-item",
          {
            id: `${listId}-opt-${i}`,
            role: "option",
            "aria-selected": "false",
            onpointerdown: (e) => e.preventDefault(), // verhindert Blur vor Klick (Maus + Touch)
            onclick: () => pick({ name: s.name, id: s.id ?? null, isNew: false }),
          },
          h("span.ac-item-name", {}, s.name),
          s.hint != null ? h("span.ac-item-hint", {}, s.hint) : null
        )
      );
    });

    if (allowCreate && q !== "" && !exact) {
      const text = cfg.createLabel ? cfg.createLabel(q) : `„${q}“ neu`;
      list.append(
        h(
          "li.ac-item.ac-create",
          {
            id: `${listId}-opt-new`,
            role: "option",
            "aria-selected": "false",
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => pick({ name: q, id: null, isNew: true }),
          },
          h("span.ac-plus", {}, icon("plus", 16)),
          h("span.ac-item-name", {}, text)
        )
      );
    }

    const open = list.childElementCount > 0;
    wrap.classList.toggle("open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
    setActive(null);
  }

  // Enter: aktiven Vorschlag, sonst exakte Übereinstimmung, sonst getippten
  // Text neu anlegen, sonst ersten Vorschlag.
  function commitEnter() {
    const active = list.querySelector(".ac-item.active");
    if (active) {
      active.click();
      return;
    }
    const q = input.value.trim();
    if (!q) return;
    const items = cfg.getSuggestions(q) || [];
    const exact = items.find((s) => s.name.toLowerCase() === q.toLowerCase());
    if (exact) pick({ name: exact.name, id: exact.id ?? null, isNew: false });
    else if (allowCreate) pick({ name: q, id: null, isNew: true });
    else if (items[0]) pick({ name: items[0].name, id: items[0].id ?? null, isNew: false });
  }

  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("blur", () => setTimeout(close, 180));
  input.addEventListener("keydown", (e) => {
    const opts = options();
    if (e.key === "ArrowDown" && opts.length) {
      e.preventDefault();
      const idx = opts.indexOf(list.querySelector(".ac-item.active"));
      setActive(opts[idx + 1] ?? opts[0]);
    } else if (e.key === "ArrowUp" && opts.length) {
      e.preventDefault();
      const idx = opts.indexOf(list.querySelector(".ac-item.active"));
      setActive(idx <= 0 ? opts[opts.length - 1] : opts[idx - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitEnter();
    } else if (e.key === "Escape") {
      close();
      input.blur();
    }
  });

  return { el: wrap, focus: () => input.focus() };
}
