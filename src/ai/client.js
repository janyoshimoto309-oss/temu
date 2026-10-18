var TZ = TZ || {};

TZ.ai = {
  timer: null,
  inflight: false,
  pending: [],

  schedule: function (parsedList, settings) {
    if (!settings.ai || !settings.ai.enabled) return;
    this.pending = parsedList.slice();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(settings), 400);
  },

  flush: async function (settings) {
    if (this.inflight) return;
    const enabledLabels = TZ.AI_EXCLUSIONS.filter((x) => settings.aiExclusions && settings.aiExclusions[x.id]).map(
      (x) => x.id
    );
    if (!enabledLabels.length) return;

    const viewport = [];
    const rest = [];
    this.pending.forEach((p) => {
      if (p.card.getAttribute(TZ.STATE_ATTR) === "dim") return;
      if (TZ.cards.inViewport(p.card)) viewport.push(p);
      else rest.push(p);
    });
    const batch = viewport.concat(rest).slice(0, 8);
    if (!batch.length) return;

    this.inflight = true;
    try {
      const items = batch.map((p) => ({
        id: p.goodsId || p.href || p.title,
        title: p.title,
        category: p.zhiliao && p.zhiliao.category,
        imageUrl: p.imageUrl || "",
        needImage: this._titleVague(p.title)
      }));
      const res = await TZ.runtimeSend({
        type: TZ.MSG.AI_CLASSIFY,
        items: items,
        labels: enabledLabels,
        model: settings.ai.model
      });
      if (!res || !res.ok) {
        if (TZ.panel && TZ.panel.setAiStatus) {
          TZ.panel.setAiStatus(res && res.error ? res.error : "AI 请求失败");
        }
        return;
      }
      const byId = {};
      (res.results || []).forEach((r) => {
        if (r && r.id) byId[r.id] = r;
      });
      batch.forEach((p) => {
        const id = p.goodsId || p.href || p.title;
        const r = byId[id];
        if (!r || !r.hit) return;
        if (p.card.getAttribute(TZ.STATE_ATTR) === "dim") return;
        const reason = "AI：" + (r.reason || (r.labels || []).join("、") || "复杂类型");
        TZ.dimmer.mark(p.card, true, [reason]);
      });
      TZ.dimmer.recount();
      if (TZ.panel && TZ.panel.updateStatus) TZ.panel.updateStatus();
      if (TZ.panel && TZ.panel.setAiStatus) TZ.panel.setAiStatus("已补判 " + (res.results || []).length + " 张");
    } catch (err) {
      if (TZ.panel && TZ.panel.setAiStatus) TZ.panel.setAiStatus(String(err.message || err));
    } finally {
      this.inflight = false;
    }
  },

  _titleVague: function (title) {
    if (!title) return true;
    const t = title.trim();
    if (t.length < 12) return true;
    if (/^[A-Za-z0-9\s\-_.]+$/.test(t) && t.length < 28) return true;
    return false;
  }
};

TZ.runtimeSend = function (msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res);
      });
    } catch (err) {
      resolve({ ok: false, error: String(err.message || err) });
    }
  });
};
