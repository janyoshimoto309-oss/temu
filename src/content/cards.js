var TZ = TZ || {};

TZ.cards = {
  _isOurHost: function (el) {
    return !!(el && (el.id === TZ.HOST_ID || el.closest && el.closest("#" + TZ.HOST_ID)));
  },

  findZhiliaoPanels: function () {
    const panels = [];
    if (!document.body) return panels;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.includes("知了数据")) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest("#" + TZ.HOST_ID)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const seen = new Set();
    while (walker.nextNode()) {
      let el = walker.currentNode.parentElement;
      let panel = el;
      for (let i = 0; i < 10 && el; i++) {
        if (this._isOurHost(el)) break;
        const t = el.textContent || "";
        if (t.includes("知了数据") && (t.includes("销量") || t.includes("商品") || t.includes("品类"))) {
          panel = el;
        }
        el = el.parentElement;
      }
      if (panel && !seen.has(panel) && !this._isOurHost(panel)) {
        seen.add(panel);
        panels.push(panel);
      }
    }
    return panels;
  },

  findCardFrom: function (start) {
    if (!start || this._isOurHost(start)) return null;
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
      const text = curr.textContent || "";
      const hasSoldOrPrice = /已售|\$\s*\d/.test(text) || text.includes("知了数据");
      if (hasImg && (productLink || hasSoldOrPrice)) {
        candidate = curr;
        const parent = curr.parentElement;
        if (parent && parent !== document.body) {
          const parentImages = parent.querySelectorAll("img, picture");
          if (parent.children.length >= 2 && parentImages.length > images.length) break;
        }
      }
      curr = curr.parentElement;
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

  collect: function () {
    const map = new Map();
    const panels = this.findZhiliaoPanels();

    panels.forEach((panel) => {
      const card = this.findCardFrom(panel) || panel.parentElement;
      if (!card || this._isOurHost(card)) return;
      map.set(card, { card: card, zhiliaoEl: panel });
    });

    this.listContainerChildren().forEach((el) => {
      if (this._isOurHost(el)) return;
      const card = this.findCardFrom(el) || el;
      if (!card || map.has(card)) return;
      const parsedProbe = card.querySelector("a[href], img");
      if (!parsedProbe) return;
      map.set(card, { card: card, zhiliaoEl: this._panelInside(card, panels) });
    });

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
      const parsed = TZ.parseCard(entry.card, entry.zhiliaoEl || this._panelInside(entry.card, panels));
      if (!parsed.title && !parsed.zhiliao.present && !parsed.href) return;
      records.push(parsed);
    });
    return records;
  },

  _panelInside: function (card, panels) {
    for (let i = 0; i < panels.length; i++) {
      if (card.contains(panels[i])) return panels[i];
    }
    return null;
  },

  _zhiliaoInside: function (card) {
    return this._panelInside(card, this.findZhiliaoPanels());
  },

  inViewport: function (el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 80 && r.top < window.innerHeight - 40 && r.right > 0 && r.left < window.innerWidth;
  }
};
