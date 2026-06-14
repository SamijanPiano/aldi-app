// ui.js — winzige DOM-Helfer, damit die Views ohne Framework lesbar bleiben.

/**
 * Hyperscript: h("div.card", { onclick }, child, "text").
 * - tag unterstützt CSS-Kurzschreibweise: "button.primary#go"
 * - props: on<Event> => addEventListener, dataset.* => data-Attribute,
 *   sonst Attribut. Booleans schalten Attribute an/aus.
 * Text wird stets über textContent gesetzt (kein innerHTML => kein XSS).
 */
export function h(tag, props = {}, ...children) {
  const { tagName, id, classes } = parseTag(tag);
  const el = document.createElement(tagName);
  if (id) el.id = id;
  if (classes.length) el.classList.add(...classes);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      el.classList.add(...String(value).split(/\s+/).filter(Boolean));
    } else if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  }

  // Buttons außerhalb von Formularen standardmäßig type="button" (kein Submit).
  if (tagName === "button" && !el.hasAttribute("type")) el.setAttribute("type", "button");

  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function parseTag(tag) {
  const idMatch = tag.match(/#([\w-]+)/);
  const classes = (tag.match(/\.([\w-]+)/g) || []).map((c) => c.slice(1));
  const tagName = tag.match(/^[\w-]+/)?.[0] || "div";
  return { tagName, id: idMatch ? idMatch[1] : null, classes };
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function navigate(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = hash;
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

const iconCache = new Map();

/**
 * Inline-SVG-Icon, sicher per DOMParser aus statischen, vertrauenswürdigen
 * Pfad-Strings gebaut (kein innerHTML). stroke folgt currentColor.
 * Pro (name, size) wird einmal geparst und danach nur noch geklont.
 */
export function icon(name, size = 24) {
  const key = `${name}:${size}`;
  let template = iconCache.get(key);
  if (!template) {
    const paths = ICONS[name] || "";
    const markup = `<svg xmlns="${SVG_NS}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    template = document.importNode(doc.documentElement, true);
    iconCache.set(key, template);
  }
  const span = document.createElement("span");
  span.className = "icon";
  span.setAttribute("aria-hidden", "true");
  span.append(template.cloneNode(true));
  return span;
}

const ICONS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.2 12.2a1.6 1.6 0 0 0 1.6 1.3h8.5a1.6 1.6 0 0 0 1.6-1.3L21 7H6.2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 6 8.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 .9 2.7h.1a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
  receipt: '<path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>',
  download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/>',
  upload: '<path d="M12 21V9m0 0l-4 4m4-4l4 4M4 5h16"/>',
};
