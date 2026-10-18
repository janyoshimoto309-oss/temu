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
    if (!settings.autoOpen || !settings.autoOpen.enabled) {
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

    const next = this._nextCard();
    if (!next) {
      this.timer = setTimeout(() => this._tick(settings), 1200);
      this._emit("等待未变灰商品… " + this.opened + "/" + max);
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

  _nextCard: function () {
    const cards = TZ.dimmer.passingCards();
    for (const el of cards) {
      if (el.getAttribute(TZ.AD_ATTR) === "1") continue;
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
