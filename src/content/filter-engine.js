var TZ = TZ || {};

TZ.includesAny = function (hay, needles) {
  if (!hay) return false;
  const t = String(hay).toLowerCase();
  for (const n of needles || []) {
    if (!n) continue;
    if (t.includes(String(n).toLowerCase())) return true;
  }
  return false;
};

TZ.evaluateRules = function (parsed, settings) {
  const reasons = [];
  const th = (settings && settings.thresholds) || {};
  const z = parsed.zhiliao || {};
  const hasZ = !!z.present;

  const failMin = function (got, min, label) {
    const m = TZ.emptyNum(min);
    if (m == null) return;
    if (got == null) return;
    if (got < m) reasons.push(label + " " + got + " < " + m);
  };

  if (hasZ) {
    failMin(z.daily, th.dailySalesMin, "日销");
    failMin(z.weekly, th.weeklySalesMin, "周销");
    failMin(z.monthly, th.monthlySalesMin, "月销");
    failMin(z.rating, th.ratingMin, "评分");
    failMin(z.reviews, th.reviewMin, "评论数");

    const within = TZ.emptyNum(th.listedWithinValue);
    if (within != null && !TZ.isBlankMetric(z.listedRaw) && (z.listedMonths != null || z.listedDays != null)) {
      const unit = th.listedWithinUnit === "day" ? "day" : "month";
      const months = z.listedMonths;
      const days = z.listedDays;
      const tooOld =
        unit === "day"
          ? days != null && days > within
          : months != null
            ? months > within
            : days != null && days > within * 30;
      if (tooOld) {
        reasons.push("上架超过近" + within + (unit === "day" ? "天" : "个月") + "（" + (z.listedRaw || "") + "）");
      }
    }
  }

  failMin(parsed.sold, th.temuSoldMin, "前台已售");

  const enabled = (settings && settings.exclusions) || {};
  TZ.RULE_EXCLUSIONS.forEach((rule) => {
    if (!enabled[rule.id]) return;
    if (rule.special === "pcs") {
      if (parsed.pcs != null && parsed.pcs > 20) {
        reasons.push("套装件数 " + parsed.pcs + "pcs > 20");
      }
      return;
    }
    if (hasZ && TZ.includesAny(z.category, rule.category)) {
      reasons.push("品类命中「" + rule.label + "」");
      return;
    }
    if (TZ.includesAny(parsed.title, rule.title) || (hasZ && TZ.includesAny(z.category, rule.title))) {
      reasons.push("标题/品类命中「" + rule.label + "」");
    }
  });

  return {
    dim: reasons.length > 0,
    reasons: reasons,
    needAi: reasons.length === 0
  };
};

TZ.filter = {
  settings: null,
  lastPreview: [],
  lastReasons: [],
  lastRecords: [],

  run: function (settings) {
    this.settings = settings || this.settings;
    if (!this.settings) return { dimmed: 0, marked: 0, preview: [] };

    TZ.dimmer.applyPause(this.settings.pauseDim);

    if (!TZ.pageScope.allowFilter(this.settings)) {
      TZ.dimmer.resetAll();
      this.lastPreview = [];
      this.lastRecords = [];
      TZ.panel && TZ.panel.updateStatus && TZ.panel.updateStatus();
      return { dimmed: 0, marked: 0, preview: [] };
    }

    const records = TZ.cards.collect();
    this.lastRecords = records;
    const seen = new Set();
    const preview = [];
    const aiQueue = [];

    records.forEach((parsed) => {
      const card = parsed.card;
      seen.add(card);
      card.setAttribute(TZ.CARD_ATTR, "1");
      if (parsed.goodsId) card.setAttribute(TZ.ID_ATTR, parsed.goodsId);
      if (parsed.isAd) card.setAttribute(TZ.AD_ATTR, "1");
      else card.removeAttribute(TZ.AD_ATTR);

      const verdict = TZ.evaluateRules(parsed, this.settings);
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
        this.settings.ai &&
        this.settings.ai.enabled &&
        TZ.hasAnyAiExclusion(this.settings) &&
        parsed.title
      ) {
        aiQueue.push(parsed);
      }
    });

    TZ.dimmer.clearUnseen(seen);
    const counts = TZ.dimmer.recount();
    this.lastPreview = preview;
    this.lastReasons = records
      .filter((p) => p.card.getAttribute(TZ.STATE_ATTR) === "dim")
      .slice(0, 8)
      .map((p) => ({
        title: p.title || "(无标题)",
        reason: p.card.getAttribute(TZ.REASON_ATTR) || ""
      }));

    if (aiQueue.length && TZ.ai) TZ.ai.schedule(aiQueue, this.settings);
    if (TZ.panel && TZ.panel.updateStatus) TZ.panel.updateStatus();
    return { dimmed: counts.dimmed, marked: counts.marked, preview: preview };
  }
};

TZ.hasAnyAiExclusion = function (settings) {
  const map = (settings && settings.aiExclusions) || {};
  return TZ.AI_EXCLUSIONS.some((item) => map[item.id]);
};
