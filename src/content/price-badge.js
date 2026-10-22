var TZ = TZ || {};

TZ.priceBadge = {
  run: function () {
    if (!TZ.isPluginOn()) {
      this._clearAll();
      return;
    }
    const kind = TZ.pageScope ? TZ.pageScope.refresh() : "browse";
    if (kind === "shop") {
      this._clearAll();
      return;
    }
    if (kind === "detail") {
      this._markDetail();
      this._mountSplit(this._detailHalf);
      this._markListFromRecords(false);
      return;
    }
    this._clearDetail();
    this._markListFromRecords(true);
  },

  _markListFromRecords: function (allowCollect) {
    let records = TZ.filter && TZ.filter.lastRecords ? TZ.filter.lastRecords : [];
    if ((!records || !records.length) && allowCollect && TZ.cards && TZ.cards.collect) {
      records = TZ.cards.collect();
    }
    const seen = new Set();
    (records || []).forEach((parsed) => {
      if (!parsed || !parsed.card) return;
      this._markCard(parsed);
      seen.add(parsed.card);
    });
    this._clearUnseen(seen);
  },

  _isOurs: function (el) {
    if (!el) return true;
    if (el.id === TZ.HOST_ID) return true;
    if (el.classList && (el.classList.contains(TZ.HALF_CLASS) || el.classList.contains("tz-sku-split"))) return true;
    if (
      el.closest &&
      (el.closest("#" + TZ.HOST_ID) || el.closest("." + TZ.HALF_CLASS) || el.closest(".tz-sku-split"))
    ) {
      return true;
    }
    return false;
  },

  _ownText: function (el) {
    if (!el) return "";
    return String(el.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  _compact: function (el) {
    return this._ownText(el).replace(/\s+/g, "");
  },

  _salePriceFromText: function (text) {
    return TZ.parseSalePrice(text);
  },

  _findAnchor: function (root, n) {
    if (!root || !root.querySelectorAll || n == null) return null;
    const needle = "$" + n.toFixed(2);
    let best = null;
    let bestLen = Infinity;
    const els = root.querySelectorAll("*");
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (this._isOurs(el)) continue;
      const c = this._compact(el);
      if (!c || c.indexOf(needle) < 0) continue;
      if (c.length < bestLen) {
        best = el;
        bestLen = c.length;
      }
    }
    return best;
  },

  _findCurrentPrice: function (root) {
    if (!root) return null;
    const raw = root.innerText || root.textContent || "";
    const n = this._salePriceFromText(raw);
    if (n == null) return null;
    const el = this._findAnchor(root, n);
    if (!el) return null;
    return { el: el, n: n };
  },

  _findZhiliaoHost: function (card) {
    if (!card || !card.querySelectorAll) return null;
    const els = card.querySelectorAll("*");
    for (let i = 0; i < els.length; i++) {
      const sr = TZ.openShadow(els[i]);
      if (!sr) continue;
      const t = sr.textContent || "";
      if (t.includes("知了数据") || t.includes("上架时间") || t.includes("销量")) return els[i];
    }
    return null;
  },

  _ensure: function (scope, extraClass) {
    let badge = scope.querySelector("." + TZ.HALF_CLASS);
    if (!badge) {
      badge = document.createElement("span");
      badge.className = TZ.HALF_CLASS + (extraClass ? " " + extraClass : "");
      badge.setAttribute(TZ.HALF_ATTR, "1");
    }
    return badge;
  },

  _placeAfter: function (anchor, badge) {
    if (!anchor || !anchor.parentNode) return false;
    if (badge.parentNode === anchor.parentNode && badge.previousSibling === anchor) return true;
    anchor.parentNode.insertBefore(badge, anchor.nextSibling);
    return true;
  },

  _markCard: function (parsed) {
    const card = parsed.card;
    if (TZ.pageScope && TZ.pageScope.isUiChrome && TZ.pageScope.isUiChrome(card)) return;
    const found = this._findCurrentPrice(card);
    if (!found) return;
    const half = TZ.formatHalfPrice(found.n);
    if (!half) return;
    const badge = this._ensure(card, TZ.HALF_CLASS + "--list");
    if (
      badge.parentNode &&
      card.contains(badge) &&
      badge.getAttribute("data-tz-half-of") === String(found.n)
    ) {
      if (badge.textContent !== half) badge.textContent = half;
      return;
    }
    badge.setAttribute("data-tz-half-of", String(found.n));
    if (badge.textContent !== half) badge.textContent = half;
    const zh =
      (parsed.zhiliaoEl && card.contains(parsed.zhiliaoEl) && parsed.zhiliaoEl) || this._findZhiliaoHost(card);
    if (zh && this._placeAfter(zh, badge)) return;
    this._placeAfter(found.el, badge);
  },

  _findCartButton: function () {
    const nodes = document.querySelectorAll("button, div, span");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (this._isOurs(el)) continue;
      if (TZ.pageScope && TZ.pageScope.isUiChrome && TZ.pageScope.isUiChrome(el)) continue;
      const t = (el.innerText || "").replace(/\s+/g, "");
      if (!t || t.length > 24) continue;
      if (t.indexOf("加入购物车") === 0 || t.indexOf("立即加购") === 0 || t.indexOf("Addtocart") === 0) {
        return el;
      }
    }
    return null;
  },

  _detailScope: function () {
    const cart = this._findCartButton();
    if (!cart) return document.body;
    let p = cart.parentElement;
    for (let i = 0; i < 14 && p && p !== document.body; i++) {
      if (TZ.pageScope && TZ.pageScope.isUiChrome && TZ.pageScope.isUiChrome(p)) {
        p = p.parentElement;
        continue;
      }
      const w = p.offsetWidth || 0;
      if (w >= 260 && w <= 720) return p;
      p = p.parentElement;
    }
    return cart.parentElement || document.body;
  },

  _markDetail: function () {
    if (!document.body) return;
    this._detailHalf = "";
    const scope = this._detailScope();
    const found = this._findCurrentPrice(scope) || this._findCurrentPrice(document.body);
    if (!found) return;
    const half = TZ.formatHalfPrice(found.n);
    if (!half) return;
    this._detailHalf = half;
    let badge = document.querySelector("." + TZ.HALF_CLASS + "--detail");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = TZ.HALF_CLASS + " " + TZ.HALF_CLASS + "--detail";
      badge.setAttribute(TZ.HALF_ATTR, "1");
    }
    if (badge.parentNode && badge.getAttribute("data-tz-half-of") === String(found.n)) {
      if (badge.textContent !== half) badge.textContent = half;
      return;
    }
    if (TZ.pageScope && TZ.pageScope.isUiChrome && TZ.pageScope.isUiChrome(found.el)) return;
    badge.setAttribute("data-tz-half-of", String(found.n));
    if (badge.textContent !== half) badge.textContent = half;
    this._placeAfter(found.el, badge);
  },

  _clearUnseen: function (seen) {
    document.querySelectorAll("." + TZ.HALF_CLASS + "--list").forEach((el) => {
      const card = el.closest("[" + TZ.CARD_ATTR + '="1"]') || el.parentElement;
      if (card && seen.has(card)) return;
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  },

  _clearList: function () {
    document.querySelectorAll("." + TZ.HALF_CLASS + "--list").forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  },

  _clearDetail: function () {
    document.querySelectorAll("." + TZ.HALF_CLASS + "--detail").forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this._clearSplit();
  },

  _buyColumn: function (cart) {
    let p = cart && cart.parentElement;
    let best = null;
    for (let i = 0; i < 18 && p && p !== document.body; i++) {
      if (TZ.pageScope && TZ.pageScope.isUiChrome && TZ.pageScope.isUiChrome(p)) {
        p = p.parentElement;
        continue;
      }
      const rect = p.getBoundingClientRect();
      if (rect.width >= 260 && rect.width <= 980 && rect.height >= 80) best = p;
      if (rect.width > 980) break;
      p = p.parentElement;
    }
    return best;
  },

  _findSkuRow: function (scope, cart) {
    if (!scope || scope === document.body || !scope.querySelectorAll) return null;
    const cartTop = cart && cart.getBoundingClientRect ? cart.getBoundingClientRect().top : Infinity;
    let best = null;
    let bestTop = -Infinity;
    const nodes = scope.querySelectorAll("div");
    for (let i = 0; i < nodes.length; i++) {
      const row = nodes[i];
      if (this._isOurs(row)) continue;
      if (cart && (row === cart || row.contains(cart))) continue;
      const rect = row.getBoundingClientRect();
      if (rect.width < 140 || rect.height < 24 || rect.height > 160) continue;
      if (rect.top > cartTop + 8) continue;
      const kids = row.children;
      if (!kids || kids.length < 2) continue;
      let chips = 0;
      for (let k = 0; k < kids.length; k++) {
        const child = kids[k];
        if (child.classList && child.classList.contains("tz-sku-split")) continue;
        const box = child.getBoundingClientRect();
        if (box.width >= 20 && box.width <= 360 && box.height >= 18 && box.height <= 120) chips += 1;
      }
      if (chips >= 2 && rect.top >= bestTop) {
        best = row;
        bestTop = rect.top;
      }
    }
    return best;
  },

  _ensureSplit: function () {
    let box = document.querySelector(".tz-sku-split");
    if (box) return box;
    box = document.createElement("div");
    box.className = "tz-sku-split";
    box.setAttribute(TZ.HALF_ATTR, "split");
    const stop = function (e) {
      e.stopPropagation();
    };
    box.addEventListener("pointerdown", stop);
    box.addEventListener("click", stop);
    box.addEventListener("keydown", stop);
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "0";
    qty.step = "1";
    qty.className = "tz-sku-split-qty";
    qty.placeholder = "数量";
    qty.title = "物品数量";
    qty.value = this._qty || "";
    qty.addEventListener("input", () => {
      this._qty = qty.value;
      this._fillSplit(this._detailHalf);
    });
    const out = document.createElement("input");
    out.type = "text";
    out.readOnly = true;
    out.tabIndex = -1;
    out.className = "tz-sku-split-out";
    out.placeholder = "半价/数量";
    out.title = "半价 ÷ 数量";
    box.appendChild(qty);
    box.appendChild(out);
    return box;
  },

  _mountSplit: function (halfText) {
    if (location.href !== this._splitHref) {
      this._splitHref = location.href;
      this._qty = "";
      this._clearSplit();
    }
    const cart = this._findCartButton();
    const column = this._buyColumn(cart) || this._detailScope();
    const row = this._findSkuRow(column, cart);
    const anchor = row || cart;
    if (!anchor || !anchor.parentNode) return;
    const box = this._ensureSplit();
    const next = row ? row.nextSibling : cart;
    if (box.parentNode !== anchor.parentNode || box.nextSibling !== (row ? next : cart)) {
      anchor.parentNode.insertBefore(box, row ? row.nextSibling : cart);
    }
    this._fillSplit(halfText);
  },

  _fillSplit: function (halfText) {
    const box = document.querySelector(".tz-sku-split");
    if (!box) return;
    const qty = box.querySelector(".tz-sku-split-qty");
    const out = box.querySelector(".tz-sku-split-out");
    if (qty && document.activeElement !== qty && qty.value !== (this._qty || "")) qty.value = this._qty || "";
    const q = TZ.emptyNum ? TZ.emptyNum(qty ? qty.value : this._qty) : null;
    const h = parseFloat(halfText);
    const cents = Number.isFinite(h) ? Math.round(h * 100) : NaN;
    const each = q != null && q > 0 && Number.isFinite(cents) ? Math.round(cents / q) / 100 : NaN;
    if (out) out.value = Number.isFinite(each) ? each.toFixed(2) : "";
  },

  _clearSplit: function () {
    document.querySelectorAll(".tz-sku-split").forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  },

  _clearAll: function () {
    this._clearList();
    this._clearDetail();
  }
};
