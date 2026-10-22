var TZ = TZ || {};

TZ.observer = {
  mo: null,
  timer: null,
  url: "",

  start: function () {
    this.url = location.href;
    if (this.mo) this.mo.disconnect();
    this.mo = new MutationObserver((mutations) => {
      if (this._running) return;
      if (!chrome.runtime || !chrome.runtime.id) {
        this.mo.disconnect();
        return;
      }
      let relevant = false;
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.id === TZ.HOST_ID || (node.closest && node.closest("#" + TZ.HOST_ID))) continue;
          if (node.classList && (node.classList.contains(TZ.HALF_CLASS) || node.classList.contains("tz-sku-split"))) continue;
          if (node.closest && node.closest(".tz-sku-split")) continue;
          const tag = node.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "META") continue;
          relevant = true;
          break;
        }
        if (relevant) break;
      }
      if (relevant) this.schedule();
    });
    this.mo.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener(
      "scroll",
      () => {
        if (TZ.pageScope && TZ.pageScope.refresh() === "detail") return;
        this.schedule();
      },
      { passive: true }
    );
    window.addEventListener("popstate", () => this.onUrlChange());
    this._wrapHistory();
    setInterval(() => {
      if (location.href !== this.url) this.onUrlChange();
      else this.schedule();
    }, 1600);
  },

  schedule: function () {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this._running) return;
      this._running = true;
      try {
        const kind = TZ.pageScope ? TZ.pageScope.refresh() : "browse";
        if (kind !== "detail" && TZ.filter && TZ.filter.settings) TZ.filter.run(TZ.filter.settings);
        if (TZ.detailRecs) TZ.detailRecs.run(TZ.filter && TZ.filter.settings);
        if (TZ.priceBadge) TZ.priceBadge.run();
      } finally {
        this._running = false;
      }
    }, 280);
  },

  onUrlChange: function () {
    this.url = location.href;
    if (TZ.cards && TZ.cards.clearCache) TZ.cards.clearCache();
    TZ.pageScope.refresh();
    this.schedule();
    if (TZ.panel && TZ.panel.updateStatus) TZ.panel.updateStatus();
  },

  _wrapHistory: function () {
    if (history.__tzWrapped) return;
    history.__tzWrapped = true;
    const wrap = (fn) =>
      function () {
        const ret = fn.apply(this, arguments);
        try {
          TZ.observer.onUrlChange();
        } catch (e) {}
        return ret;
      };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
  }
};
