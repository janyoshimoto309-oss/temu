var TZ = TZ || {};

TZ.panel = {
  host: null,
  root: null,
  settings: null,
  saveTimer: null,
  syncing: false,
  aiStatus: "",

  toggle: function () {
    if (!this.settings) return;
    this.settings.panelCollapsed = !this.settings.panelCollapsed;
    this._applyCollapsed();
    TZ.saveSettings(this.settings);
  },

  expand: function () {
    if (!this.settings) return;
    this.settings.panelCollapsed = false;
    this._applyCollapsed();
    TZ.saveSettings(this.settings);
  },

  _applyCollapsed: function () {
    if (!this.root) return;
    this.root.classList.toggle("is-collapsed", !!this.settings.panelCollapsed);
    this._applyPos();
    this._applyPluginOn();
  },

  _applyPluginOn: function () {
    if (!this.root) return;
    const on = TZ.isPluginOn(this.settings);
    this.root.classList.toggle("is-plugin-off", !on);
    const power = this._el("pluginPower");
    if (power) power.checked = on;
    if (!on && TZ.autoOpen && TZ.autoOpen.running) TZ.autoOpen.stop();
  },

  _applyPos: function () {
    if (!this.root) return;
    const s = this.settings || {};
    if (s.panelLeft == null || s.panelTop == null) {
      this.root.style.left = "";
      this.root.style.top = "";
      this.root.style.right = "16px";
      this.root.style.bottom = "16px";
      return;
    }
    this.root.style.right = "auto";
    this.root.style.bottom = "auto";
    this.root.style.left = s.panelLeft + "px";
    this.root.style.top = s.panelTop + "px";
  },

  mount: async function (settings) {
    this.settings = settings;
    if (document.getElementById(TZ.HOST_ID)) {
      this.host = document.getElementById(TZ.HOST_ID);
      this.root = this.host.shadowRoot.querySelector(".tz-root");
      this.sync(settings);
      return;
    }

    const host = document.createElement("div");
    host.id = TZ.HOST_ID;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483646";
    const shadow = host.attachShadow({ mode: "open" });
    let css = "";
    try {
      css = await fetch(chrome.runtime.getURL("src/panel/panel.css")).then((r) => r.text());
    } catch (e) {
      css = "";
    }
    const style = document.createElement("style");
    style.textContent = css;
    shadow.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "tz-root";
    wrap.innerHTML = this._html();
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);

    this.host = host;
    this.root = wrap;
    this._bind();
    this._bindDrag();
    this.sync(settings);
  },

  _thresholdGrid: function (attr, unitAttr) {
    return `
            <div class="tz-grid">
              <div class="tz-field"><label>知了日销 ≥</label><input type="number" min="0" ${attr}="dailySalesMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了周销 ≥</label><input type="number" min="0" ${attr}="weeklySalesMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了月销 ≥</label><input type="number" min="0" ${attr}="monthlySalesMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>Temu 已售 ≥</label><input type="number" min="0" ${attr}="temuSoldMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了评分 ≥</label><input type="number" min="0" step="0.1" ${attr}="ratingMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了评论 ≥</label><input type="number" min="0" ${attr}="reviewMin" placeholder="空=不启用"></div>
              <div class="tz-field span2">
                <label>上架超过此时长就变灰（近 N）</label>
                <div class="tz-row">
                  <input type="number" min="0" ${attr}="listedWithinValue" placeholder="空=不启用">
                  <select ${unitAttr}="listedWithinUnit">
                    <option value="month">个月</option>
                    <option value="day">天</option>
                  </select>
                </div>
              </div>
            </div>`;
  },

  _html: function () {
    const ruleChecks = TZ.RULE_EXCLUSIONS.map(
      (r) =>
        `<label class="tz-check"><input type="checkbox" data-ex="${r.id}"><span>${r.label}</span></label>`
    ).join("");
    const aiChecks = TZ.AI_EXCLUSIONS.map(
      (r) =>
        `<label class="tz-check"><input type="checkbox" data-ai-ex="${r.id}"><span>${r.label}</span></label>`
    ).join("");

    return `
      <div class="tz-dock" data-act="expand">
        <span class="tz-dock-dot"></span>
        <strong>知了筛选</strong>
        <span class="tz-dock-count" data-el="dockCount">0</span>
      </div>
      <section class="tz-panel">
        <header class="tz-head">
          <div>
            <div class="tz-title">Temu × 知了筛选</div>
            <div class="tz-sub">只读页面 · 命中变灰仍能看清</div>
          </div>
          <div class="tz-head-actions">
            <label class="tz-power" title="插件总开关">
              <input type="checkbox" data-el="pluginPower" checked>
              <span class="tz-power-track"><span class="tz-power-knob"></span></span>
            </label>
            <button class="tz-icon-btn" type="button" data-act="collapse" title="收起">–</button>
          </div>
        </header>
        <div class="tz-status">
          <span>已标灰 <b class="tz-pill" data-el="dimCount">0</b></span>
          <label class="tz-check"><input type="checkbox" data-el="pauseDim"><span>暂时取消变灰</span></label>
        </div>
        <div class="tz-body">
          <div class="tz-block">
            <div class="tz-block-title">
              筛选 <span class="hint">两套数字为或 · 品类命中即灰</span>
              <button class="tz-btn primary" type="button" data-act="saveRules">保存规则</button>
            </div>
            <div class="tz-muted" data-el="saveMeta" style="margin-bottom:8px">改完会自动记住，下次打开自动加载。也可点保存。</div>
            <label class="tz-check" style="margin-bottom:8px">
              <input type="checkbox" data-el="searchPageEnabled">
              <span>搜索页也筛选（默关）</span>
            </label>
            <div class="tz-pack-title">第一套数字</div>
            ${this._thresholdGrid("data-th", "data-th-unit")}
            <div class="tz-pack-title">第二套数字（过此套也可留下）</div>
            ${this._thresholdGrid("data-th-b", "data-th-b-unit")}
            <div class="tz-muted" style="margin:6px 0 8px">两套之间是「或」：过其中一套数字门槛即可留下。每套内部仍是「并且」。某套全空则该套不启用。页面上销量为「-」或空的，跳过该条。品类命中仍变灰，数字救不回来。</div>
            <div class="tz-block-title" style="margin-top:10px">不看 / 不做（规则）</div>
            <div class="tz-checks">${ruleChecks}</div>
          </div>

          <div class="tz-block">
            <div class="tz-block-title">AI 分类 <span class="hint">功能 B · 单独可关</span></div>
            <label class="tz-check"><input type="checkbox" data-el="aiEnabled"><span>启用 AI 分类（只补规则漏网）</span></label>
            <div class="tz-field" style="margin:8px 0">
              <label>Gemini API Key（只存扩展后台）</label>
              <div class="tz-row">
                <input type="password" data-el="apiKey" placeholder="AIza…" autocomplete="off" style="flex:1">
                <button class="tz-btn ghost" type="button" data-act="saveKey">保存</button>
              </div>
              <div class="tz-muted" data-el="keyMeta">未保存密钥</div>
            </div>
            <div class="tz-checks">${aiChecks}</div>
            <div class="tz-muted" style="margin-top:6px" data-el="aiStatus"></div>
          </div>

          <div class="tz-block c-block">
            <div class="tz-block-title">自动点开 <span class="hint">独立模块 C · 不参与变灰</span></div>
            <label class="tz-check"><input type="checkbox" data-el="autoEnabled"><span>启用自动点开（默认关）</span></label>
            <div class="tz-grid" style="margin-top:8px">
              <div class="tz-field"><label>最多点开 N 个</label><input type="number" min="1" data-el="autoMax"></div>
              <div class="tz-field"><label>两次间隔（秒）</label><input type="number" min="0.8" step="0.1" data-el="autoInterval"></div>
              <div class="tz-field span2"><label>只点日销 ≥（仅自动点开，不变灰）</label><input type="number" min="0" data-el="autoDaily" placeholder="空=不限制"></div>
            </div>
            <div class="tz-row" style="margin-top:8px">
              <button class="tz-btn primary" type="button" data-act="aoStart">开始</button>
              <button class="tz-btn warn" type="button" data-act="aoPause">暂停</button>
              <button class="tz-btn ghost" type="button" data-act="aoStop">停止</button>
            </div>
            <div class="tz-msg" data-el="aoMsg">关着时筛选只变灰，绝不跳转。</div>
          </div>

          <details class="tz-more">
            <summary>解析预览 / 为何被标灰</summary>
            <div class="tz-preview" data-el="preview">等待扫描商品卡…</div>
          </details>
        </div>
      </section>
    `;
  },

  _el: function (name) {
    return this.root.querySelector('[data-el="' + name + '"]');
  },

  _bind: function () {
    const root = this.root;
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      if (act === "collapse") {
        this.settings.panelCollapsed = true;
        this._applyCollapsed();
        this._persist();
      } else if (act === "expand") {
        if (this._dragMoved) {
          this._dragMoved = false;
          return;
        }
        this.settings.panelCollapsed = false;
        this._applyCollapsed();
        this._persist();
      } else if (act === "saveKey") this._saveKey();
      else if (act === "saveRules") this.saveNow(true);
      else if (act === "aoStart") TZ.autoOpen.start(this.settings);
      else if (act === "aoPause") TZ.autoOpen.pause();
      else if (act === "aoStop") TZ.autoOpen.stop();
      this.updateAutoOpen();
    });

    root.addEventListener("change", () => {
      if (this.syncing) return;
      this._readForm();
    });
    root.addEventListener("input", (e) => {
      if (this.syncing) return;
      if (e.target && e.target.getAttribute("data-el") === "apiKey") return;
      this._readForm();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.saveNow(false);
    });
    window.addEventListener("pagehide", () => this.saveNow(false));
    window.addEventListener("resize", () => {
      if (this.settings && this.settings.panelLeft != null) {
        this._setPos(this.settings.panelLeft, this.settings.panelTop);
      }
    });
    const power = this._el("pluginPower");
    if (power) {
      power.addEventListener("click", (e) => e.stopPropagation());
      power.addEventListener("change", () => {
        if (this.syncing) return;
        this.settings.pluginEnabled = power.checked;
        this._applyPluginOn();
        this._persist();
        TZ.filter.run(this.settings);
        if (TZ.detailRecs) TZ.detailRecs.run(this.settings);
        if (TZ.priceBadge) TZ.priceBadge.run();
      });
    }
  },

  _bindDrag: function () {
    const head = this.root.querySelector(".tz-head");
    const dock = this.root.querySelector(".tz-dock");
    if (head) this._makeDraggable(head, false);
    if (dock) this._makeDraggable(dock, true);
  },

  _makeDraggable: function (handle, isDock) {
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let st = 0;
    let dragging = false;
    let moved = 0;
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".tz-power")) return;
      if (!isDock && e.target.closest("[data-act]")) return;
      dragging = true;
      moved = 0;
      const r = this.root.getBoundingClientRect();
      sl = r.left;
      st = r.top;
      sx = e.clientX;
      sy = e.clientY;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      moved += Math.abs(dx) + Math.abs(dy);
      this._setPos(sl + dx, st + dy);
    });
    handle.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      this._dragMoved = moved > 6;
      this._persist();
    });
  },

  _setPos: function (left, top) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = this.root.getBoundingClientRect();
    const minL = vw / 2;
    const maxL = Math.max(minL, vw - r.width - 8);
    const maxT = Math.max(8, vh - r.height - 8);
    left = Math.min(maxL, Math.max(minL, left));
    top = Math.min(maxT, Math.max(8, top));
    this.settings.panelLeft = Math.round(left);
    this.settings.panelTop = Math.round(top);
    this._applyPos();
  },

  _readForm: function () {
    const s = this.settings;
    s.searchPageEnabled = this._el("searchPageEnabled").checked;
    s.pauseDim = this._el("pauseDim").checked;
    s.ai.enabled = this._el("aiEnabled").checked;
    s.autoOpen.enabled = this._el("autoEnabled").checked;
    s.autoOpen.maxCount = TZ.emptyNum(this._el("autoMax").value) || 10;
    s.autoOpen.intervalSec = TZ.emptyNum(this._el("autoInterval").value) || 2.5;
    s.autoOpen.dailySalesMin = TZ.emptyNum(this._el("autoDaily").value);

    const th = s.thresholds;
    this.root.querySelectorAll("[data-th]").forEach((input) => {
      th[input.getAttribute("data-th")] = TZ.emptyNum(input.value);
    });
    const unit = this.root.querySelector("[data-th-unit]");
    if (unit) th.listedWithinUnit = unit.value;

    if (!s.thresholdsB) s.thresholdsB = {};
    const thB = s.thresholdsB;
    this.root.querySelectorAll("[data-th-b]").forEach((input) => {
      thB[input.getAttribute("data-th-b")] = TZ.emptyNum(input.value);
    });
    const unitB = this.root.querySelector("[data-th-b-unit]");
    if (unitB) thB.listedWithinUnit = unitB.value;

    s.exclusions = {};
    this.root.querySelectorAll("[data-ex]").forEach((box) => {
      s.exclusions[box.getAttribute("data-ex")] = box.checked;
    });
    s.aiExclusions = {};
    this.root.querySelectorAll("[data-ai-ex]").forEach((box) => {
      s.aiExclusions[box.getAttribute("data-ai-ex")] = box.checked;
    });

    this._persist();
    TZ.filter.run(s);
    if (TZ.detailRecs) TZ.detailRecs.run(s);
    if (TZ.priceBadge) TZ.priceBadge.run();
  },

  _persist: function () {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(false), 200);
  },

  saveNow: async function (manual) {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.settings) return;
    const saved = await TZ.saveSettings(this.settings);
    this.settings.savedAt = saved && saved.savedAt;
    this.updateSaveMeta(manual);
  },

  updateSaveMeta: function (manual) {
    const el = this._el("saveMeta");
    if (!el) return;
    const ts = this.settings && this.settings.savedAt;
    const time = ts ? new Date(ts).toLocaleString() : "";
    el.textContent = manual
      ? "已保存，下次打开 Temu 会自动加载。" + (time ? "（" + time + "）" : "")
      : time
        ? "已自动记住当前规则（" + time + "）"
        : "改完会自动记住，下次打开自动加载。也可点保存。";
  },

  _saveKey: async function () {
    const input = this._el("apiKey");
    const key = (input.value || "").trim();
    const res = await TZ.runtimeSend({ type: TZ.MSG.SET_API_KEY, key: key });
    input.value = "";
    this._el("keyMeta").textContent = res && res.ok ? "密钥已保存到后台（" + (res.tail || "") + "）" : "保存失败";
  },

  sync: function (settings) {
    this.settings = settings;
    if (!this.root) return;
    this.syncing = true;
    this._applyCollapsed();
    this._applyPos();
    this._applyPluginOn();
    this._el("searchPageEnabled").checked = !!settings.searchPageEnabled;
    this._el("pauseDim").checked = !!settings.pauseDim;
    this._el("aiEnabled").checked = !!(settings.ai && settings.ai.enabled);
    this._el("autoEnabled").checked = !!(settings.autoOpen && settings.autoOpen.enabled);
    this._el("autoMax").value = settings.autoOpen.maxCount;
    this._el("autoInterval").value = settings.autoOpen.intervalSec;
    const autoDaily = settings.autoOpen.dailySalesMin;
    this._el("autoDaily").value = autoDaily == null ? "" : autoDaily;

    const th = settings.thresholds || {};
    this.root.querySelectorAll("[data-th]").forEach((input) => {
      const key = input.getAttribute("data-th");
      const v = th[key];
      input.value = v == null ? "" : v;
    });
    const unit = this.root.querySelector("[data-th-unit]");
    if (unit) unit.value = th.listedWithinUnit || "month";

    const thB = settings.thresholdsB || {};
    this.root.querySelectorAll("[data-th-b]").forEach((input) => {
      const key = input.getAttribute("data-th-b");
      const v = thB[key];
      input.value = v == null ? "" : v;
    });
    const unitB = this.root.querySelector("[data-th-b-unit]");
    if (unitB) unitB.value = thB.listedWithinUnit || "month";

    this.root.querySelectorAll("[data-ex]").forEach((box) => {
      box.checked = !!(settings.exclusions && settings.exclusions[box.getAttribute("data-ex")]);
    });
    this.root.querySelectorAll("[data-ai-ex]").forEach((box) => {
      box.checked = !!(settings.aiExclusions && settings.aiExclusions[box.getAttribute("data-ai-ex")]);
    });

    this.updateStatus();
    this.updateAutoOpen();
    this.updateSaveMeta(false);
    this.refreshKeyMeta();
    this.syncing = false;
  },

  updateStatus: function () {
    if (!this.root) return;
    const n = TZ.dimmer.dimmedCount || 0;
    this._el("dimCount").textContent = String(n);
    this.root.querySelector('[data-el="dockCount"]').textContent = String(n);
    const preview = this._el("preview");
    const lines = [];
    (TZ.filter.lastPreview || []).forEach((p, i) => {
      lines.push(
        "#" +
          (i + 1) +
          " " +
          (p.title || "(无标题)").slice(0, 36) +
          "\n  知了:" +
          (p.zhiliao ? "有" : "无") +
          " 日" +
          (p.daily == null ? "-" : p.daily) +
          " 周" +
          (p.weekly == null ? "-" : p.weekly) +
          " 月" +
          (p.monthly == null ? "-" : p.monthly) +
          " 已售" +
          (p.sold == null ? "-" : p.sold) +
          "\n  品类:" +
          (p.category || "-") +
          " 上架:" +
          (p.listedRaw || "-") +
          (p.listedMonths != null ? "(" + Number(p.listedMonths).toFixed(1) + "个月)" : "") +
          " 评分:" +
          (p.rating == null ? "-" : p.rating) +
          "/" +
          (p.reviews == null ? "-" : p.reviews) +
          "\n  " +
          (p.dim ? "变灰：" + (p.reasons || []).join("；") : "保留")
      );
    });
    (TZ.filter.lastReasons || []).slice(0, 5).forEach((r) => {
      lines.push("灰 " + String(r.title).slice(0, 24) + " · " + r.reason);
    });
    preview.textContent = lines.join("\n") || "当前页还没扫到商品卡。请打开知了数据后滚动列表。";
    if (this.aiStatus) this.setAiStatus(this.aiStatus);
  },

  setAiStatus: function (text) {
    this.aiStatus = text || "";
    if (this._el("aiStatus")) this._el("aiStatus").textContent = this.aiStatus;
  },

  updateAutoOpen: function () {
    if (!this.root) return;
    const msg = this._el("aoMsg");
    const parts = [TZ.autoOpen.statusText()];
    if (TZ.autoOpen.lastMessage) parts.push(TZ.autoOpen.lastMessage);
    if (!TZ.dimmer.hasFilterMarks()) parts.push("尚无筛选标记");
    msg.textContent = parts.join(" · ");
  },

  refreshKeyMeta: async function () {
    const res = await TZ.runtimeSend({ type: TZ.MSG.GET_API_KEY_META });
    if (this._el("keyMeta")) {
      this._el("keyMeta").textContent = res && res.set ? "已保存密钥（" + res.tail + "）" : "未保存密钥";
    }
  }
};
