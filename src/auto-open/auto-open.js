var TZ = TZ || {};

TZ.autoOpen = {
  running: false,
  paused: false,
  opened: 0,
  timer: null,
  seen: new Set(),

  statusText: function () {
    if (!this.running) return "未运行";
    if (this.paused) return "已暂停 " + this.opened + " 个";
    return "进行中 " + this.opened + " 个";
  },

  canStart: function (settings) {
    if (!TZ.isPluginOn(settings)) {
      return { ok: false, reason: "插件总开关已关闭" };
    }
    if (!settings || !settings.autoOpen || !settings.autoOpen.enabled) {
      return { ok: false, reason: "请先打开「启用自动点开」" };
    }
    if (!TZ.dimmer.hasFilterMarks()) {
      return { ok: false, reason: "还没有筛选标记。请先用筛选侧跑一遍，避免未筛选时乱点全站。" };
    }
    return { ok: true };
  },

  start: function (settings) {
    const gate = this.canStart(settings);
    if (!gate.ok) {
      this._emit(gate.reason);
      return gate;
    }
    this.running = true;
    this.paused = false;
    this.opened = 0;
    this.seen = new Set();
    this._emit("已开始");
    this._tick(settings);
    return gate;
  },

  pause: function () {
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._emit("已暂停");
  },

  resume: function (settings) {
    if (!this.running) return this.start(settings);
    this.paused = false;
    this._emit("继续");
    this._tick(settings);
  },

  stop: function () {
    this.running = false;
    this.paused = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._emit("已停止");
  },

  _tick: async function (settings) {
    if (!this.running || this.paused) return;
    if (!TZ.isPluginOn(settings) || !settings.autoOpen || !settings.autoOpen.enabled) {
      this.stop();
      return;
    }
    const max = Math.max(1, Number(settings.autoOpen.maxCount) || 10);
    if (this.opened >= max) {
      this.running = false;
      this._emit("已达上限 " + max);
      if (TZ.panel && TZ.panel.updateAutoOpen) TZ.panel.updateAutoOpen();
      return;
    }

    const next = this._nextCard(settings);
    if (!next) {
      const more = this._loadMore();
      this.timer = setTimeout(() => this._tick(settings), more ? 1800 : 1200);
      this._emit(
        (more ? "正在下滑并点查看更多…" : "等待未变灰且点开门槛达标的商品…") + " " + this.opened + "/" + max
      );
      if (TZ.panel && TZ.panel.updateAutoOpen) TZ.panel.updateAutoOpen();
      return;
    }

    next.el.scrollIntoView({ block: "center", behavior: "smooth" });
    const href = next.href;
    this.seen.add(href);
    await TZ.runtimeSend({ type: TZ.MSG.OPEN_TAB, url: href });
    this.opened += 1;
    this._emit("已打开 " + this.opened + "/" + max);
    if (TZ.panel && TZ.panel.updateAutoOpen) TZ.panel.updateAutoOpen();

    const wait = Math.max(800, (Number(settings.autoOpen.intervalSec) || 2.5) * 1000);
    this.timer = setTimeout(() => this._tick(settings), wait);
  },

  _loadMore: function () {
    window.scrollBy(0, Math.max(480, Math.floor(window.innerHeight * 0.85)));
    const more = this._findSeeMore();
    if (more) {
      more.click();
      return true;
    }
    return false;
  },

  _findSeeMore: function () {
    const re = /查看更多|View more|See more|Load more|Show more/i;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    let best = null;
    while ((node = walker.nextNode())) {
      if (node.closest && node.closest("#" + TZ.HOST_ID)) continue;
      if (this._isZhiliao(node)) continue;
      const t = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || t.length > 24) continue;
      if (!re.test(t)) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 24 || r.height < 12 || r.width > 480 || r.height > 80) continue;
      best = node;
    }
    return best;
  },

  _isZhiliao: function (el) {
    let n = el;
    while (n && n !== document.body) {
      const id = String(n.id || "");
      const cls = String(n.className || "");
      if (/zhiliao|zhile|zl-data|知了/i.test(id + " " + cls)) return true;
      n = n.parentElement;
    }
    return false;
  },

  _recordOf: function (el) {
    const recs = TZ.filter && TZ.filter.lastRecords;
    if (!recs || !el) return null;
    for (let i = 0; i < recs.length; i++) {
      if (recs[i] && recs[i].card === el) return recs[i];
    }
    return null;
  },

  _passesExtra: function (el, settings) {
    const ao = (settings && settings.autoOpen) || {};
    const parsed = this._recordOf(el);
    if (!parsed) return true;
    const reasons = TZ.numericReasons(parsed, {
      dailySalesMin: ao.dailySalesMin,
      monthlySalesMin: ao.monthlySalesMin,
      temuSoldMin: ao.temuSoldMin,
      listedWithinValue: ao.listedWithinValue,
      listedWithinUnit: ao.listedWithinUnit
    });
    return !reasons.length;
  },

  _nextCard: function (settings) {
    const cards = TZ.dimmer.passingCards();
    for (const el of cards) {
      if (!this._passesExtra(el, settings)) continue;
      let href = "";
      const anchors = el.querySelectorAll("a[href]");
      for (let i = 0; i < anchors.length; i++) {
        const h = TZ.productHref(anchors[i]);
        if (TZ.isProductHref(h)) {
          href = h;
          break;
        }
      }
      if (!href || this.seen.has(href)) continue;
      return { el: el, href: href };
    }
    return null;
  },

  _emit: function (text) {
    this.lastMessage = text;
    if (TZ.panel && TZ.panel.updateAutoOpen) TZ.panel.updateAutoOpen();
  }
};
