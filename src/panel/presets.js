var TZ = TZ || {};

TZ.presets = {
  TH_KEYS: [
    "dailySalesMin",
    "weeklySalesMin",
    "monthlySalesMin",
    "temuSoldMin",
    "ratingMin",
    "reviewMin",
    "listedWithinValue",
    "listedWithinUnit"
  ],
  AO_KEYS: [
    "dailySalesMin",
    "monthlySalesMin",
    "ratingMin",
    "reviewMin",
    "temuSoldMin",
    "listedWithinValue",
    "listedWithinUnit"
  ],
  AO_EL: {
    dailySalesMin: "autoDaily",
    monthlySalesMin: "autoMonthly",
    ratingMin: "autoRating",
    reviewMin: "autoReviews",
    temuSoldMin: "autoTemuSold",
    listedWithinValue: "autoListed",
    listedWithinUnit: "autoListedUnit"
  },

  ensure: function (settings) {
    if (!settings.numericPresets) settings.numericPresets = { thresholds: [], thresholdsB: [], autoOpen: [] };
    const p = settings.numericPresets;
    if (!Array.isArray(p.thresholds)) p.thresholds = [];
    if (!Array.isArray(p.thresholdsB)) p.thresholdsB = [];
    if (!Array.isArray(p.autoOpen)) p.autoOpen = [];
    return p;
  },

  list: function (settings, slot) {
    const p = this.ensure(settings);
    return p[slot] || [];
  },

  collect: function (root, slot) {
    const data = {};
    if (slot === "autoOpen") {
      this.AO_KEYS.forEach((key) => {
        const el = root.querySelector('[data-el="' + this.AO_EL[key] + '"]');
        if (!el) {
          data[key] = key === "listedWithinUnit" ? "month" : null;
          return;
        }
        if (key === "listedWithinUnit") data[key] = el.value || "month";
        else data[key] = TZ.emptyNum(el.value);
      });
      return data;
    }
    const numAttr = slot === "thresholdsB" ? "data-th-b" : "data-th";
    const unitSel = slot === "thresholdsB" ? "[data-th-b-unit]" : "[data-th-unit]";
    this.TH_KEYS.forEach((key) => {
      if (key === "listedWithinUnit") {
        const unit = root.querySelector(unitSel);
        data[key] = unit && unit.value ? unit.value : "month";
        return;
      }
      const input = root.querySelector("[" + numAttr + '="' + key + '"]');
      data[key] = input ? TZ.emptyNum(input.value) : null;
    });
    return data;
  },

  apply: function (root, slot, data) {
    if (!data) return false;
    if (slot === "autoOpen") {
      this.AO_KEYS.forEach((key) => {
        const el = root.querySelector('[data-el="' + this.AO_EL[key] + '"]');
        if (!el) return;
        if (key === "listedWithinUnit") el.value = data[key] || "month";
        else el.value = data[key] == null ? "" : data[key];
      });
      return true;
    }
    const numAttr = slot === "thresholdsB" ? "data-th-b" : "data-th";
    const unitSel = slot === "thresholdsB" ? "[data-th-b-unit]" : "[data-th-unit]";
    this.TH_KEYS.forEach((key) => {
      if (key === "listedWithinUnit") {
        const unit = root.querySelector(unitSel);
        if (unit) unit.value = data[key] || "month";
        return;
      }
      const input = root.querySelector("[" + numAttr + '="' + key + '"]');
      if (input) input.value = data[key] == null ? "" : data[key];
    });
    return true;
  },

  save: function (settings, slot, name, data) {
    const p = this.ensure(settings);
    const list = p[slot];
    const trimmed = String(name || "").trim();
    if (!trimmed) return { ok: false, reason: "请先填写方案名称" };
    let hit = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === trimmed) {
        hit = list[i];
        break;
      }
    }
    if (hit) {
      hit.data = data;
      return { ok: true, id: hit.id, replaced: true };
    }
    const id = "p" + Date.now();
    list.push({ id: id, name: trimmed, data: data });
    return { ok: true, id: id, replaced: false };
  },

  remove: function (settings, slot, id) {
    const p = this.ensure(settings);
    const list = p[slot] || [];
    const next = list.filter((item) => item && item.id !== id);
    p[slot] = next;
    return next;
  },

  find: function (settings, slot, id) {
    const list = this.list(settings, slot);
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  },

  fillSelect: function (select, settings, slot, keepId) {
    if (!select) return;
    const list = this.list(settings, slot);
    const cur = keepId || select.value;
    select.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = list.length ? "选择已存方案" : "还没有已存方案";
    select.appendChild(ph);
    list.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.name;
      select.appendChild(opt);
    });
    if (cur && this.find(settings, slot, cur)) select.value = cur;
  }
};
