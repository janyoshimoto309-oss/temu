var TZ = TZ || {};

TZ.detailRecs = {
  _href: "",

  run: function (settings) {
    settings = settings || (TZ.filter && TZ.filter.settings);
    if (!settings) return;
    if (!TZ.isPluginOn(settings)) return;
    if (!TZ.pageScope || TZ.pageScope.refresh() !== "detail") return;

    TZ.dimmer.applyPause(settings.pauseDim);
    if (location.href !== this._href) {
      this._href = location.href;
      TZ.dimmer.resetAll();
    }

    const pageId = TZ.goodsIdFromHref(location.href);
    const map = new Map();
    TZ.beginScan();
    try {
      const anchors = document.body.querySelectorAll("a[href]");
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        if (TZ.cards && TZ.cards._isOurHost && TZ.cards._isOurHost(a)) continue;
        const h = TZ.productHref(a);
        if (!TZ.isProductHref(h)) continue;
        const id = TZ.goodsIdFromHref(h);
        if (pageId && id && id === pageId) continue;
        const card = TZ.cards.findCardFrom(a);
        if (!card) continue;
        if (TZ.cards._isOurHost && TZ.cards._isOurHost(card)) continue;
        if (this._skipMain(card, pageId)) continue;
        if (!map.has(card)) map.set(card, card);
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
      const seen = new Set();
      const preview = [];
      const aiQueue = [];

      map.forEach((card) => {
        const parsed = TZ.parseCard(card, null);
        if (pageId && parsed.goodsId && parsed.goodsId === pageId) return;
        if (this._skipMain(card, pageId)) return;
        if (!parsed.title && !parsed.zhiliao.present && !parsed.href) return;

        records.push(parsed);
        seen.add(card);
        card.setAttribute(TZ.CARD_ATTR, "1");
        if (parsed.goodsId) card.setAttribute(TZ.ID_ATTR, parsed.goodsId);
        if (parsed.isAd) card.setAttribute(TZ.AD_ATTR, "1");
        else card.removeAttribute(TZ.AD_ATTR);

        const verdict = TZ.evaluateRules(parsed, settings);
        TZ.dimmer.mark(card, verdict.dim, verdict.reasons);

        if (TZ.cards.inViewport(card) && preview.length < 2) {
          preview.push({
            title: parsed.title,
            category: parsed.zhiliao.category,
            daily: parsed.zhiliao.daily,
            weekly: parsed.zhiliao.weekly,
            monthly: parsed.zhiliao.monthly,
            listedRaw: parsed.zhiliao.listedRaw,
            listedMonths: parsed.zhiliao.listedMonths,
            rating: parsed.zhiliao.rating,
            reviews: parsed.zhiliao.reviews,
            sold: parsed.sold,
            zhiliao: parsed.zhiliao.present,
            dim: verdict.dim,
            reasons: verdict.reasons
          });
        }

        if (
          !verdict.dim &&
          settings.ai &&
          settings.ai.enabled &&
          TZ.hasAnyAiExclusion(settings) &&
          parsed.title
        ) {
          aiQueue.push(parsed);
        }
      });

      TZ.dimmer.clearUnseen(seen);
      const counts = TZ.dimmer.recount();
      if (TZ.filter) {
        TZ.filter.lastRecords = records;
        TZ.filter.lastPreview = preview;
        TZ.filter.lastReasons = records
          .filter((p) => p.card.getAttribute(TZ.STATE_ATTR) === "dim")
          .slice(0, 8)
          .map((p) => ({
            title: p.title || "(无标题)",
            reason: p.card.getAttribute(TZ.REASON_ATTR) || ""
          }));
      }
      if (aiQueue.length && TZ.ai) TZ.ai.schedule(aiQueue, settings);
      if (TZ.panel && TZ.panel.updateStatus) TZ.panel.updateStatus();
      return counts;
    } finally {
      TZ.endScan();
    }
  },

  _skipMain: function (card, pageId) {
    if (!card) return true;
    const r = card.getBoundingClientRect();
    if (r.height > Math.max(720, window.innerHeight * 0.75)) return true;
    if (TZ.pageScope && TZ.pageScope.isUiChrome && TZ.pageScope.isUiChrome(card)) return true;
    if (pageId && card.getAttribute && card.getAttribute(TZ.ID_ATTR) === pageId) return true;
    const t = TZ.cards._lightText ? TZ.cards._lightText(card) : String(card.textContent || "");
    if (t.length > 8000) return true;
    if (/添加到购物车|立即加购|加入购物车/.test(t) && /数量/.test(t)) return true;
    return false;
  }
};
