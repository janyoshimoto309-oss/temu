var TZ = TZ || {};

TZ.priceBadge = {
  run: function () {
    const kind = TZ.pageScope ? TZ.pageScope.refresh() : "browse";
    if (kind === "shop") {
      this._clearAll();
      return;
    }
    if (kind === "detail") {
      this._markDetail();
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
    if (el.classList && el.classList.contains(TZ.HALF_CLASS)) return true;
    if (el.closest && (el.closest("#" + TZ.HOST_ID) || el.closest("." + TZ.HALF_CLASS))) return true;
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
    if (!text) return null;
    let t = String(text).replace(/\u00a0/g, " ");
    t = t.replace(/今天支付\s*\$?\s*\d+\.\d{2}/g, "");
    t = t.replace(/今日支付\s*\$?\s*\d+\.\d{2}/g, "");
    t = t.replace(/抵用金[\s\S]{0,16}\$\d+\.\d{2}/g, "");
    t = t.replace(/\$\d+\.\d{2}\s*抵用金/g, "");
    t = t.replace(/赔付\$\d+\.\d{2}/g, "");
    t = t.replace(/超时赔付[^\d$]{0,12}\$\d+\.\d{2}/g, "");
    const prices = [];
    const re = /\$(\d+)\.(\d{2})/g;
    let m;
    while ((m = re.exec(t))) {
      const n = parseFloat(m[1] + "." + m[2]);
      if (Number.isFinite(n) && n > 0 && n <= 2000) prices.push(n);
    }
    if (!prices.length) return null;
    prices.sort(function (a, b) {
      return a - b;
    });
    const uniq = [];
    for (let i = 0; i < prices.length; i++) {
      if (!uniq.length || Math.abs(uniq[uniq.length - 1] - prices[i]) > 0.001) uniq.push(prices[i]);
    }
    return uniq[0];
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
    const found = this._findCurrentPrice(card);
    if (!found) return;
    const half = TZ.formatHalfPrice(found.n);
    if (!half) return;
    const badge = this._ensure(card, TZ.HALF_CLASS + "--list");
    if (badge.getAttribute("data-tz-half-of") === String(found.n) && badge.textContent === half) {
      const zh =
        (parsed.zhiliaoEl && card.contains(parsed.zhiliaoEl) && parsed.zhiliaoEl) || this._findZhiliaoHost(card);
      if (zh && badge.previousSibling === zh) return;
      if (!zh && badge.previousSibling === found.el) return;
    }
    badge.setAttribute("data-tz-half-of", String(found.n));
    if (badge.textContent !== half) badge.textContent = half;
    const zh =
      (parsed.zhiliaoEl && card.contains(parsed.zhiliaoEl) && parsed.zhiliaoEl) || this._findZhiliaoHost(card);
    if (zh && this._placeAfter(zh, badge)) return;
    this._placeAfter(found.el, badge);
  },

  _detailScope: function () {
    const nodes = document.querySelectorAll("button, div, span");
    let cart = null;
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (this._isOurs(el)) continue;
      const t = (el.innerText || "").replace(/\s+/g, "");
      if (!t || t.length > 24) continue;
      if (t.indexOf("加入购物车") === 0 || t.indexOf("立即加购") === 0 || t.indexOf("Addtocart") === 0) {
        cart = el;
        break;
      }
    }
    if (!cart) return document.body;
    let p = cart.parentElement;
    for (let i = 0; i < 14 && p && p !== document.body; i++) {
      const w = p.offsetWidth || 0;
      if (w >= 260 && w <= 720) return p;
      p = p.parentElement;
    }
    return cart.parentElement || document.body;
  },

  _markDetail: function () {
    if (!document.body) return;
    const scope = this._detailScope();
    const found = this._findCurrentPrice(scope) || this._findCurrentPrice(document.body);
    if (!found) return;
    const half = TZ.formatHalfPrice(found.n);
    if (!half) return;
    let badge = document.querySelector("." + TZ.HALF_CLASS + "--detail");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = TZ.HALF_CLASS + " " + TZ.HALF_CLASS + "--detail";
      badge.setAttribute(TZ.HALF_ATTR, "1");
    }
    if (badge.getAttribute("data-tz-half-of") === String(found.n) && badge.parentNode && badge.previousSibling === found.el) {
      if (badge.textContent !== half) badge.textContent = half;
      return;
    }
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
  },

  _clearAll: function () {
    this._clearList();
    this._clearDetail();
  }
};
