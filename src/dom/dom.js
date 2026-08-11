/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* A small jQuery stand-in.
 *
 * The client had ~500 jQuery call sites across ui.js, forms.js and friends.
 * Rewriting each as querySelectorAll + loops would have ballooned those files
 * and invited transcription bugs, so this provides the subset of the jQuery
 * API the client actually used — nothing more. It is deliberately not a
 * general-purpose library: every method here exists because something in
 * src/ calls it.
 *
 * Differences from jQuery worth knowing:
 *   - No effects queue. .animate() is implemented on the Web Animations API
 *     and returns a promise-bearing object rather than queueing.
 *   - .data() stores values in a WeakMap, not in dataset, so non-string
 *     values round-trip (jQuery does the same).
 *   - Events are delegated through a single listener per (element, type),
 *     which is enough for the client's usage and keeps removal simple.
 */

const ELEMENT_NODE = 1;

/** Parse an HTML string into a list of nodes. */
function parseHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return Array.from(template.content.childNodes).filter(
    (n) => n.nodeType === ELEMENT_NODE || (n.nodeType === 3 && n.textContent.trim()),
  );
}

/** Per-element arbitrary data, keyed like jQuery's .data(). */
const dataStore = new WeakMap();
/** Per-element event bookkeeping so .off() can find what .on() registered. */
const eventStore = new WeakMap();

function getData(el) {
  let d = dataStore.get(el);
  if (!d) {
    d = {};
    dataStore.set(el, d);
  }
  return d;
}

/* jQuery writes unitless numbers for these; everything else gets "px". */
const UNITLESS = new Set([
  "opacity",
  "zIndex",
  "zoom",
  "fontWeight",
  "lineHeight",
  "order",
  "flexGrow",
  "flexShrink",
  "columnCount",
  "fillOpacity",
  "strokeOpacity",
]);

function camelCase(name) {
  return name.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
}

function setStyle(el, name, value) {
  const prop = camelCase(name);
  if (typeof value === "number" && !UNITLESS.has(prop)) {
    value = value + "px";
  }
  if (prop in el.style) {
    el.style[prop] = value;
  } else {
    el.style.setProperty(name, value);
  }
}

/* jQuery accepted a handful of pseudo-selectors that are not valid CSS. The
   client relies on several of them — `:visible` in windowing.js, and
   `:password` as the default value of the ignoreForms config — so they are
   translated rather than dropped. */
const INPUT_PSEUDOS = {
  ":password": 'input[type="password"]',
  ":text": 'input[type="text"]',
  ":checkbox": 'input[type="checkbox"]',
  ":radio": 'input[type="radio"]',
  ":file": 'input[type="file"]',
  ":submit": 'input[type="submit"], button[type="submit"]',
  ":button": 'button, input[type="button"]',
  ":input": "input, textarea, select, button",
  ":selected": "option:checked",
};

function isVisible(node) {
  if (!node || node.nodeType !== ELEMENT_NODE) return false;
  return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
}

/** Split a selector into a native part and any jQuery visibility pseudos. */
function compileSelector(selector) {
  let native = String(selector);
  let visibility = null;
  native = native.replace(/:visible\b/g, () => {
    visibility = true;
    return "";
  });
  native = native.replace(/:hidden\b/g, () => {
    visibility = false;
    return "";
  });
  for (const [pseudo, replacement] of Object.entries(INPUT_PSEUDOS)) {
    if (native.includes(pseudo)) {
      native = native.split(pseudo).join(replacement);
    }
  }
  native = native.trim();
  // ":visible" alone leaves nothing to match on natively.
  if (!native || native === ",") native = "*";
  return { native, visibility };
}

/** matches() that understands the jQuery pseudo-selectors above. */
function matchesSelector(node, selector) {
  if (!node || node.nodeType !== ELEMENT_NODE) return false;
  const { native, visibility } = compileSelector(selector);
  let ok;
  try {
    ok = node.matches(native);
  } catch (e) {
    console.warn("Bad selector:", selector, e);
    return false;
  }
  if (ok && visibility !== null) {
    ok = isVisible(node) === visibility;
  }
  return ok;
}

function queryAll(root, selector) {
  const { native, visibility } = compileSelector(selector);
  let found;
  try {
    found = Array.from(root.querySelectorAll(native));
  } catch (e) {
    console.warn("Bad selector:", selector, e);
    return [];
  }
  if (visibility !== null) {
    found = found.filter((node) => isVisible(node) === visibility);
  }
  return found;
}

function flatten(input) {
  if (input === null || input === undefined) return [];
  if (input instanceof DomList) return input.nodes.slice();
  if (typeof input === "string") {
    // A selector, or a chunk of markup.
    return input.trim()[0] === "<" ? parseHTML(input) : queryAll(document, input);
  }
  if (input.nodeType || input === window) return [input];
  if (typeof input.length === "number") return Array.from(input);
  return [input];
}

class DomList {
  constructor(nodes, prevObject) {
    this.nodes = nodes;
    this.length = nodes.length;
    // Backs .end(), which restores the previous set in a chain.
    this.prevObject = prevObject || null;
    // Indexed access: el[0] is used all over the client.
    for (let i = 0; i < nodes.length; i++) {
      this[i] = nodes[i];
    }
  }

  /* ---- traversal ---- */

  get(i) {
    if (i === undefined) return this.nodes.slice();
    return i < 0 ? this.nodes[this.nodes.length + i] : this.nodes[i];
  }

  eq(i) {
    const node = this.get(i);
    return new DomList(node ? [node] : [], this);
  }

  first() {
    return this.eq(0);
  }

  last() {
    return this.eq(-1);
  }

  toArray() {
    return this.nodes.slice();
  }

  each(fn) {
    this.nodes.forEach((node, i) => fn.call(node, i, node));
    return this;
  }

  map(fn) {
    return new DomList(
      this.nodes.map((node, i) => fn.call(node, i, node)).filter((v) => v != null),
      this,
    );
  }

  find(selector) {
    const out = [];
    for (const node of this.nodes) {
      if (!node.querySelectorAll) continue;
      for (const found of queryAll(node, selector)) {
        if (!out.includes(found)) out.push(found);
      }
    }
    return new DomList(out, this);
  }

  filter(selector) {
    const test =
      typeof selector === "function"
        ? (node, i) => selector.call(node, i, node)
        : (node) => matchesSelector(node, selector);
    return new DomList(this.nodes.filter(test), this);
  }

  not(selector) {
    return new DomList(
      this.nodes.filter((node) => !matchesSelector(node, selector)),
      this,
    );
  }

  is(selector) {
    if (typeof selector === "function") {
      return this.nodes.some((node, i) => selector.call(node, i, node));
    }
    if (selector instanceof DomList) {
      return this.nodes.some((node) => selector.nodes.includes(node));
    }
    if (selector && selector.nodeType) {
      return this.nodes.includes(selector);
    }
    return this.nodes.some((node) => matchesSelector(node, selector));
  }

  has(selector) {
    return new DomList(
      this.nodes.filter((node) => node.querySelector && node.querySelector(selector)),
      this,
    );
  }

  closest(selector) {
    const out = [];
    for (const node of this.nodes) {
      const found = node.closest && node.closest(selector);
      if (found && !out.includes(found)) out.push(found);
    }
    return new DomList(out, this);
  }

  parent() {
    const out = [];
    for (const node of this.nodes) {
      if (node.parentNode && !out.includes(node.parentNode)) out.push(node.parentNode);
    }
    return new DomList(out, this);
  }

  parents(selector) {
    const out = [];
    for (const node of this.nodes) {
      let p = node.parentNode;
      while (p && p.nodeType === ELEMENT_NODE) {
        if ((!selector || p.matches(selector)) && !out.includes(p)) out.push(p);
        p = p.parentNode;
      }
    }
    return new DomList(out, this);
  }

  children(selector) {
    const out = [];
    for (const node of this.nodes) {
      for (const child of node.children || []) {
        if ((!selector || matchesSelector(child, selector)) && !out.includes(child)) {
          out.push(child);
        }
      }
    }
    return new DomList(out, this);
  }

  siblings(selector) {
    const out = [];
    for (const node of this.nodes) {
      for (const sib of node.parentNode ? node.parentNode.children : []) {
        if (sib !== node && (!selector || sib.matches(selector)) && !out.includes(sib)) {
          out.push(sib);
        }
      }
    }
    return new DomList(out, this);
  }

  next(selector) {
    const out = [];
    for (const node of this.nodes) {
      const sib = node.nextElementSibling;
      if (sib && (!selector || sib.matches(selector))) out.push(sib);
    }
    return new DomList(out, this);
  }

  prev(selector) {
    const out = [];
    for (const node of this.nodes) {
      const sib = node.previousElementSibling;
      if (sib && (!selector || sib.matches(selector))) out.push(sib);
    }
    return new DomList(out, this);
  }

  contents() {
    const out = [];
    for (const node of this.nodes) out.push(...node.childNodes);
    return new DomList(out, this);
  }

  add(other) {
    const out = this.nodes.slice();
    for (const node of flatten(other)) {
      if (!out.includes(node)) out.push(node);
    }
    return new DomList(out, this);
  }

  index(target) {
    if (target === undefined) {
      const node = this.nodes[0];
      if (!node || !node.parentNode) return -1;
      return Array.from(node.parentNode.children).indexOf(node);
    }
    return this.nodes.indexOf(flatten(target)[0]);
  }

  /** Restore the set this chain was derived from (jQuery's .end()). */
  end() {
    return this.prevObject || new DomList([]);
  }

  /* ---- classes and attributes ---- */

  addClass(names) {
    const list = String(names).split(/\s+/).filter(Boolean);
    for (const node of this.nodes) node.classList.add(...list);
    return this;
  }

  removeClass(names) {
    if (names === undefined) {
      for (const node of this.nodes) node.className = "";
      return this;
    }
    const list = String(names).split(/\s+/).filter(Boolean);
    for (const node of this.nodes) node.classList.remove(...list);
    return this;
  }

  toggleClass(name, force) {
    for (const node of this.nodes) node.classList.toggle(name, force);
    return this;
  }

  hasClass(name) {
    return this.nodes.some((node) => node.classList && node.classList.contains(name));
  }

  attr(name, value) {
    if (typeof name === "object") {
      for (const node of this.nodes) {
        for (const [k, v] of Object.entries(name)) node.setAttribute(k, v);
      }
      return this;
    }
    if (value === undefined) {
      const node = this.nodes[0];
      if (!node || !node.getAttribute) return undefined;
      const found = node.getAttribute(name);
      // jQuery yields undefined, not null, for a missing attribute.
      return found === null ? undefined : found;
    }
    for (const node of this.nodes) {
      if (value === null) node.removeAttribute(name);
      else node.setAttribute(name, value);
    }
    return this;
  }

  removeAttr(name) {
    for (const node of this.nodes) node.removeAttribute(name);
    return this;
  }

  prop(name, value) {
    if (value === undefined) {
      const node = this.nodes[0];
      return node ? node[name] : undefined;
    }
    for (const node of this.nodes) node[name] = value;
    return this;
  }

  data(key, value) {
    if (key === undefined) {
      return this.nodes[0] ? getData(this.nodes[0]) : {};
    }
    if (value === undefined) {
      const node = this.nodes[0];
      if (!node) return undefined;
      const store = getData(node);
      if (key in store) return store[key];
      // Fall back to data-* attributes, as jQuery does.
      const attr = node.getAttribute && node.getAttribute("data-" + key);
      return attr === null || attr === undefined ? undefined : attr;
    }
    for (const node of this.nodes) getData(node)[key] = value;
    return this;
  }

  removeData(key) {
    for (const node of this.nodes) delete getData(node)[key];
    return this;
  }

  /* ---- content ---- */

  text(value) {
    if (value === undefined) {
      return this.nodes.map((n) => n.textContent).join("");
    }
    for (const node of this.nodes) node.textContent = value;
    return this;
  }

  html(value) {
    if (value === undefined) {
      return this.nodes[0] ? this.nodes[0].innerHTML : undefined;
    }
    for (const node of this.nodes) node.innerHTML = value;
    return this;
  }

  val(value) {
    if (value === undefined) {
      const node = this.nodes[0];
      if (!node) return undefined;
      if (node.type === "checkbox" || node.type === "radio") return node.checked;
      if (node.tagName === "SELECT" && node.multiple) {
        return Array.from(node.selectedOptions).map((o) => o.value);
      }
      return node.value;
    }
    for (const node of this.nodes) {
      if (node.type === "checkbox" || node.type === "radio") node.checked = !!value;
      else node.value = value;
    }
    return this;
  }

  /* ---- style and geometry ---- */

  css(name, value) {
    if (typeof name === "object") {
      for (const node of this.nodes) {
        for (const [k, v] of Object.entries(name)) setStyle(node, k, v);
      }
      return this;
    }
    if (value === undefined) {
      const node = this.nodes[0];
      if (!node || node.nodeType !== ELEMENT_NODE) return undefined;
      return getComputedStyle(node)[camelCase(name)];
    }
    for (const node of this.nodes) setStyle(node, name, value);
    return this;
  }

  show() {
    for (const node of this.nodes) {
      if (node.nodeType !== ELEMENT_NODE) continue;
      if (getComputedStyle(node).display === "none") node.style.display = "";
      // An inline display:none in the markup wins over the empty value above.
      if (getComputedStyle(node).display === "none") node.style.display = "block";
    }
    return this;
  }

  hide() {
    for (const node of this.nodes) {
      if (node.style) node.style.display = "none";
    }
    return this;
  }

  width(value) {
    if (value === undefined) {
      const node = this.nodes[0];
      if (!node) return undefined;
      if (node === window) return window.innerWidth;
      // $(document).width() is the full scrollable width, as in jQuery.
      if (node.nodeType === 9) {
        return Math.max(
          node.documentElement.scrollWidth,
          node.documentElement.offsetWidth,
          node.body ? node.body.scrollWidth : 0,
        );
      }
      return parseFloat(getComputedStyle(node).width) || node.offsetWidth || 0;
    }
    return this.css("width", value);
  }

  height(value) {
    if (value === undefined) {
      const node = this.nodes[0];
      if (!node) return undefined;
      if (node === window) return window.innerHeight;
      if (node.nodeType === 9) {
        return Math.max(
          node.documentElement.scrollHeight,
          node.documentElement.offsetHeight,
          node.body ? node.body.scrollHeight : 0,
        );
      }
      return parseFloat(getComputedStyle(node).height) || node.offsetHeight || 0;
    }
    return this.css("height", value);
  }

  outerWidth(includeMargin) {
    const node = this.nodes[0];
    if (!node) return undefined;
    if (node === window) return window.innerWidth;
    let w = node.offsetWidth;
    if (includeMargin) {
      const s = getComputedStyle(node);
      w += parseFloat(s.marginLeft) + parseFloat(s.marginRight);
    }
    return w;
  }

  outerHeight(includeMargin) {
    const node = this.nodes[0];
    if (!node) return undefined;
    if (node === window) return window.innerHeight;
    let h = node.offsetHeight;
    if (includeMargin) {
      const s = getComputedStyle(node);
      h += parseFloat(s.marginTop) + parseFloat(s.marginBottom);
    }
    return h;
  }

  offset() {
    const node = this.nodes[0];
    if (!node || !node.getBoundingClientRect) return undefined;
    const rect = node.getBoundingClientRect();
    return { top: rect.top + window.scrollY, left: rect.left + window.scrollX };
  }

  position() {
    const node = this.nodes[0];
    if (!node) return undefined;
    return { top: node.offsetTop, left: node.offsetLeft };
  }

  scrollTop(value) {
    const node = this.nodes[0];
    if (value === undefined) {
      if (!node) return undefined;
      return node === window ? window.scrollY : node.scrollTop;
    }
    for (const n of this.nodes) {
      if (n === window) window.scrollTo(window.scrollX, value);
      else n.scrollTop = value;
    }
    return this;
  }

  scrollLeft(value) {
    const node = this.nodes[0];
    if (value === undefined) {
      if (!node) return undefined;
      return node === window ? window.scrollX : node.scrollLeft;
    }
    for (const n of this.nodes) {
      if (n === window) window.scrollTo(value, window.scrollY);
      else n.scrollLeft = value;
    }
    return this;
  }

  /* ---- manipulation ---- */

  append(...children) {
    for (const node of this.nodes) {
      for (const child of children) {
        for (const c of flatten(child)) node.appendChild(c);
      }
    }
    return this;
  }

  prepend(...children) {
    for (const node of this.nodes) {
      for (const child of children) {
        for (const c of flatten(child).reverse()) node.insertBefore(c, node.firstChild);
      }
    }
    return this;
  }

  appendTo(target) {
    for (const parent of flatten(target)) {
      for (const node of this.nodes) parent.appendChild(node);
    }
    return this;
  }

  prependTo(target) {
    for (const parent of flatten(target)) {
      for (const node of this.nodes.slice().reverse()) parent.insertBefore(node, parent.firstChild);
    }
    return this;
  }

  before(...content) {
    for (const node of this.nodes) {
      for (const item of content) {
        for (const c of flatten(item)) node.parentNode.insertBefore(c, node);
      }
    }
    return this;
  }

  after(...content) {
    for (const node of this.nodes) {
      for (const item of content) {
        for (const c of flatten(item).reverse()) {
          node.parentNode.insertBefore(c, node.nextSibling);
        }
      }
    }
    return this;
  }

  insertBefore(target) {
    for (const ref of flatten(target)) {
      for (const node of this.nodes) ref.parentNode.insertBefore(node, ref);
    }
    return this;
  }

  insertAfter(target) {
    for (const ref of flatten(target)) {
      for (const node of this.nodes) ref.parentNode.insertBefore(node, ref.nextSibling);
    }
    return this;
  }

  replaceWith(content) {
    for (const node of this.nodes) {
      const replacements = flatten(content);
      for (const c of replacements) node.parentNode.insertBefore(c, node);
      node.parentNode.removeChild(node);
    }
    return this;
  }

  remove() {
    for (const node of this.nodes) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    return this;
  }

  detach() {
    return this.remove();
  }

  empty() {
    for (const node of this.nodes) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }
    return this;
  }

  clone(withEvents) {
    const copies = this.nodes.map((node) => node.cloneNode(true));
    if (withEvents) {
      // The client only ever clones templates, which carry no handlers, so a
      // deep event copy has never been needed. Say so rather than pretending.
      console.warn("dom.clone(true) does not copy event handlers");
    }
    return new DomList(copies, this);
  }

  /* ---- events ---- */

  on(types, selector, handler) {
    if (typeof selector === "function") {
      handler = selector;
      selector = null;
    }
    for (const type of String(types).split(/\s+/).filter(Boolean)) {
      for (const node of this.nodes) {
        const listener = (event) => {
          let target = event.target;
          if (selector) {
            target = target.closest && target.closest(selector);
            if (!target || !node.contains(target)) return;
          }
          const result = handler.call(target, event);
          // jQuery treats `return false` as preventDefault + stopPropagation.
          if (result === false) {
            event.preventDefault();
            event.stopPropagation();
          }
          return result;
        };
        let registry = eventStore.get(node);
        if (!registry) {
          registry = [];
          eventStore.set(node, registry);
        }
        registry.push({ type, selector, handler, listener });
        node.addEventListener(type, listener, false);
      }
    }
    return this;
  }

  one(types, selector, handler) {
    if (typeof selector === "function") {
      handler = selector;
      selector = null;
    }
    const self = this;
    function once(event) {
      self.off(types, once);
      return handler.call(this, event);
    }
    return this.on(types, selector, once);
  }

  off(types, handler) {
    const typeList = types ? String(types).split(/\s+/).filter(Boolean) : null;
    for (const node of this.nodes) {
      const registry = eventStore.get(node);
      if (!registry) continue;
      for (let i = registry.length - 1; i >= 0; i--) {
        const entry = registry[i];
        if (typeList && !typeList.includes(entry.type)) continue;
        if (handler && entry.handler !== handler) continue;
        node.removeEventListener(entry.type, entry.listener, false);
        registry.splice(i, 1);
      }
    }
    return this;
  }

  trigger(type, detail) {
    for (const node of this.nodes) {
      // Native methods first, so .trigger("click") activates a real click.
      if (typeof node[type] === "function" && !detail) {
        node[type]();
        continue;
      }
      node.dispatchEvent(new CustomEvent(type, { bubbles: true, cancelable: true, detail }));
    }
    return this;
  }

  /* ---- animation ----
     Backed by the Web Animations API. The client's animations were written
     against jQuery's queue, but nothing depends on queueing — only on being
     told when an animation finishes, which .promise() provides. */

  animate(properties, options) {
    const opts = typeof options === "number" ? { duration: options } : options || {};
    const duration = opts.duration === undefined ? 400 : opts.duration;
    const animations = [];
    for (const node of this.nodes) {
      const from = {};
      const to = {};
      for (const [prop, value] of Object.entries(properties)) {
        const key = camelCase(prop);
        from[key] = getComputedStyle(node)[key];
        to[key] = typeof value === "number" && !UNITLESS.has(key) ? value + "px" : value;
      }
      const animation = node.animate([from, to], {
        duration,
        easing: opts.easing === "linear" ? "linear" : "ease",
        fill: "forwards",
      });
      animation.addEventListener("finish", () => {
        // Commit the end state so it survives the animation being discarded.
        for (const [k, v] of Object.entries(to)) node.style[k] = v;
        try {
          animation.cancel();
        } catch {
          /* already gone */
        }
        if (opts.complete) opts.complete.call(node);
      });
      animations.push(animation);
    }
    const done = Promise.all(animations.map((a) => a.finished.catch(() => {})));
    const result = new DomList(this.nodes, this.prevObject);
    result.promise = () => done;
    return result;
  }

  stop() {
    for (const node of this.nodes) {
      for (const animation of node.getAnimations ? node.getAnimations() : []) {
        animation.cancel();
      }
    }
    return this;
  }

  fadeOut(duration, complete) {
    return this.animate({ opacity: 0 }, { duration: duration || 400, complete });
  }

  fadeIn(duration, complete) {
    return this.animate({ opacity: 1 }, { duration: duration || 400, complete });
  }

  /* ---- shorthands the client uses ---- */

  focus() {
    if (this.nodes[0] && this.nodes[0].focus) this.nodes[0].focus();
    return this;
  }

  blur() {
    if (this.nodes[0] && this.nodes[0].blur) this.nodes[0].blur();
    return this;
  }
}

/* Event shorthands. With a handler they bind; with no argument they fire.
   Firing goes through .trigger(), which prefers a same-named native method —
   so .select() on an input selects its text, as jQuery's did. */
for (const type of [
  "click",
  "dblclick",
  "change",
  "submit",
  "keydown",
  "keyup",
  "keypress",
  "input",
  "scroll",
  "select",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseover",
  "mouseout",
  "resize",
  "error",
]) {
  DomList.prototype[type] = function (handler) {
    return handler ? this.on(type, handler) : this.trigger(type);
  };
}

/** $(selectorOrNodeOrHtml, [context]) — plus $(fn) for DOM-ready. */
function $(input, context) {
  if (typeof input === "function") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => input($));
    } else {
      // Match jQuery: ready callbacks are always asynchronous.
      Promise.resolve().then(() => input($));
    }
    return new DomList([]);
  }
  if (context) {
    return new DomList(flatten(context)).find(input);
  }
  return new DomList(flatten(input));
}

$.parseHTML = parseHTML;
$.matches = matchesSelector;
$.DomList = DomList;

/** True when the browser is most likely a touch-first device. */
$.isMobile = () =>
  window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 480;

export default $;
export { DomList, parseHTML };
