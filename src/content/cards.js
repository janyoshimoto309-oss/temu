var TZ = TZ || {};

TZ.cards = {
  _parseCache: new WeakMap(),
  _cardFromCache: new WeakMap(),

  clearCache: function () {
    this._parseCache = new WeakMap();
    this._cardFromCache = new WeakMap();
  },

  _isOurHost: function (el) {
    return !!(el && (el.id === TZ.HOST_ID || (el.closest && el.closest("#" + TZ.HOST_ID))));
  },

  _lightText: function (el) {
    if (!el) return "";
    return el.textContent || "";
  },

  _lightFp: function (card) {
    if (!card) return "";
    return String(card.childElementCount) + ":" + String((card.textContent || "").length);
  },

  _collectTextHits: function (root, hits) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (node.nodeValue.includes("知了数据") || node.nodeValue.includes("上架时间")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) hits.push(walker.currentNode);
    const els = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (let i = 0; i < els.length; i++) {
      const sr = TZ.openShadow(els[i]);
      if (sr) this._collectTextHits(sr, hits);
    }
  },

  findZhiliaoPanels: function () {
    const panels = [];
    if (!document.body) return panels;
    const hits = [];
    this._collectTextHits(document.body, hits);
    const seen = new Set();
    hits.forEach((node) => {
      let el = node.parentElement || TZ.composedParent(node);
      let panel = el;
      for (let i = 0; i < 12 && el; i++) {
        if (this._isOurHost(el)) break;
        const t = TZ.deepInnerText(el);
        if (
          (t.includes("知了数据") || t.includes("上架时间")) &&
          (t.includes("销量") || t.includes("商品") || t.includes("品类") || t.includes("上架时间"))
        ) {
          panel = el;
        }
        el = TZ.composedParent(el);
      }
      if (panel && !seen.has(panel) && !this._isOurHost(panel)) {
        seen.add(panel);
        panels.push(panel);
      }
    });
    return panels;
  },

  findCardFrom: function (start) {
    if (!start || this._isOurHost(start)) return null;
    const cacheKey = start.nodeType === Node.TEXT_NODE ? start.parentElement : start;
    if (cacheKey && this._cardFromCache.has(cacheKey)) {
      const hit = this._cardFromCache.get(cacheKey);
      if (hit && document.body.contains(hit)) return hit;
      if (hit == null) return null;
    }
    const found = this._findCardFromWalk(start);
    if (cacheKey) this._cardFromCache.set(cacheKey, found);
    return found;
  },

  _findCardFromWalk: function (start) {
    let curr = start.nodeType === Node.TEXT_NODE ? start.parentElement : start;
    let candidate = null;
    let depth = 0;
    while (curr && curr !== document.body && curr !== document.documentElement && depth < 20) {
      if (this._isOurHost(curr)) return null;
      const links = curr.querySelectorAll("a[href]");
      const images = curr.querySelectorAll("img, picture");
      if (links.length > 12 || images.length > 8) break;

      let productLink = false;
      for (const a of links) {
        if (TZ.isProductHref(TZ.productHref(a))) {
          productLink = true;
          break;
        }
      }
      const hasImg = images.length >= 1;
      const text = this._lightText(curr);
      if (text.includes("知了数据") && !/已售/.test(text)) {
        curr = TZ.composedParent(curr);
        depth += 1;
        continue;
      }
      const hasSoldOrPrice = /已售/.test(text);
      if (hasImg && (productLink || hasSoldOrPrice)) {
        candidate = curr;
        const parent = TZ.composedParent(curr);
        if (parent && parent !== document.body) {
          const parentLinks = parent.querySelectorAll ? parent.querySelectorAll("a[href]") : [];
          if (parentLinks.length > 16) break;
          if (!hasSoldOrPrice) {
            curr = parent;
            depth += 1;
            continue;
          }
          const parentSold = (this._lightText(parent).match(/已售/g) || []).length;
          const currSold = (text.match(/已售/g) || []).length;
          if (parentSold > currSold + 1) break;
        }
      }
      curr = TZ.composedParent(curr);
      depth += 1;
    }
    if (!candidate) return null;

    let optimal = candidate;
    while (
      optimal.parentElement &&
      optimal.parentElement !== document.body &&
      optimal.parentElement.children.length === 1 &&
      optimal.parentElement.tagName !== "BODY" &&
      optimal.parentElement.tagName !== "MAIN"
    ) {
      if (this._isOurHost(optimal.parentElement)) break;
      optimal = optimal.parentElement;
    }
    return optimal;
  },

  listContainerChildren: function () {
    const out = [];
    const lists = document.querySelectorAll(
      ".js-search-goodsList .autoFitList, .autoFitList, [class*='goodsList'] [class*='autoFit'], [class*='GoodsList']"
    );
    lists.forEach((list) => {
      if (this._isOurHost(list)) return;
      Array.from(list.children).forEach((child) => {
        if (child.nodeType === 1) out.push(child);
      });
    });
    document.querySelectorAll('div[role="group"], div[role="listitem"]').forEach((el) => {
      if (!this._isOurHost(el)) out.push(el);
    });
    return out;
  },

  _addCard: function (map, start, zhiliaoEl) {
    if (!start || this._isOurHost(start)) return;
    const card = this.findCardFrom(start) || (start.nodeType === 1 ? start : start.parentElement);
    if (!card || this._isOurHost(card)) return;
    const prev = map.get(card);
    if (prev) {
      if (!prev.zhiliaoEl && zhiliaoEl) prev.zhiliaoEl = zhiliaoEl;
      return;
    }
    map.set(card, { card: card, zhiliaoEl: zhiliaoEl || null });
  },

  collect: function () {
    const map = new Map();
    if (!document.body) return [];

    TZ.beginScan();
    try {
      const anchors = document.body.querySelectorAll("a[href]");
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        if (this._isOurHost(a)) continue;
        if (!TZ.isProductHref(TZ.productHref(a))) continue;
        this._addCard(map, a, null);
      }

      this.listContainerChildren().forEach((el) => this._addCard(map, el, null));

      if (map.size === 0) {
        this.findZhiliaoPanels().forEach((panel) => {
          this._addCard(map, panel, panel);
        });
      }

      const keys = Array.from(map.keys());
      keys.forEach((c) => {
        for (let i = 0; i < keys.length; i++) {
          const other = keys[i];
          if (c !== other && other.contains(c)) {
            map.delete(c);
            break;
          }
        }
      });

      const records = [];
      map.forEach((entry) => {
        const card = entry.card;
        const cached = this._parseCache.get(card);
        const fp = this._lightFp(card);
        let parsed;
        if (cached && cached.fp === fp && cached.parsed && cached.parsed.zhiliao && cached.parsed.zhiliao.present) {
          parsed = cached.parsed;
        } else {
          parsed = TZ.parseCard(card, entry.zhiliaoEl);
          this._parseCache.set(card, { fp: fp, parsed: parsed });
        }
        if (!parsed.title && !parsed.zhiliao.present && !parsed.href) return;
        records.push(parsed);
      });
      return records;
    } finally {
      TZ.endScan();
    }
  },

  _panelInside: function (card, panels) {
    for (let i = 0; i < panels.length; i++) {
      if (card.contains(panels[i])) return panels[i];
    }
    return null;
  },

  _zhiliaoInside: function (card) {
    if (!card) return null;
    const hits = [];
    this._collectTextHits(card, hits);
    if (!hits.length) return null;
    let el = hits[0].parentElement || TZ.composedParent(hits[0]);
    let panel = el;
    for (let i = 0; i < 12 && el && el !== card; i++) {
      if (this._isOurHost(el)) break;
      const t = this._lightText(el);
      if (
        (t.includes("知了数据") || t.includes("上架时间")) &&
        (t.includes("销量") || t.includes("商品") || t.includes("品类") || t.includes("上架时间"))
      ) {
        panel = el;
      }
      el = TZ.composedParent(el);
    }
    if (!panel || this._isOurHost(panel)) return null;
    return card.contains(panel) ? panel : null;
  },

  inViewport: function (el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 80 && r.top < window.innerHeight - 40 && r.right > 0 && r.left < window.innerWidth;
  }
};
