var TZ = TZ || {};

TZ.dimmer = {
  pause: false,
  dimmedCount: 0,
  markedCount: 0,

  applyPause: function (paused) {
    this.pause = !!paused;
    document.documentElement.classList.toggle(TZ.PAUSE_CLASS, this.pause);
  },

  mark: function (card, dim, reasons) {
    if (!card) return;
    card.setAttribute(TZ.CARD_ATTR, "1");
    card.setAttribute(TZ.STATE_ATTR, dim ? "dim" : "pass");
    card.setAttribute(TZ.REASON_ATTR, (reasons || []).join("；"));
    card.classList.toggle(TZ.DIM_CLASS, !!dim);
  },

  clearUnseen: function (seen) {
    document.querySelectorAll("[" + TZ.CARD_ATTR + '="1"]').forEach((el) => {
      if (seen.has(el)) return;
      if (!document.body.contains(el)) {
        el.classList.remove(TZ.DIM_CLASS);
      }
    });
  },

  resetAll: function () {
    document.querySelectorAll("[" + TZ.CARD_ATTR + '="1"]').forEach((el) => {
      el.classList.remove(TZ.DIM_CLASS);
      el.removeAttribute(TZ.STATE_ATTR);
      el.removeAttribute(TZ.REASON_ATTR);
      el.removeAttribute(TZ.CARD_ATTR);
    });
    this.dimmedCount = 0;
    this.markedCount = 0;
  },

  recount: function () {
    const marked = document.querySelectorAll("[" + TZ.CARD_ATTR + '="1"]');
    this.markedCount = marked.length;
    this.dimmedCount = document.querySelectorAll("." + TZ.DIM_CLASS).length;
    return { marked: this.markedCount, dimmed: this.dimmedCount };
  },

  hasFilterMarks: function () {
    return document.querySelectorAll("[" + TZ.STATE_ATTR + "]").length > 0;
  },

  passingCards: function () {
    const out = [];
    document.querySelectorAll("[" + TZ.STATE_ATTR + '="pass"]').forEach((el) => {
      if (el.getAttribute(TZ.AD_ATTR) === "1") return;
      out.push(el);
    });
    return out;
  }
};
