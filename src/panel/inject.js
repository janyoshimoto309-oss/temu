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
    this._applyFolds();
    this._applySkin();
  },

  _applyFolds: function () {
    if (!this.root) return;
    const filter = this._el("filterBlock");
    if (filter) filter.classList.toggle("is-folded", !!this.settings.filterFolded);
    const auto = this._el("autoBlock");
    if (auto) auto.classList.toggle("is-folded", !!this.settings.autoFolded);
    const foldFilter = this._el("foldFilterBtn");
    if (foldFilter) foldFilter.textContent = this.settings.filterFolded ? "展开" : "收起";
    const foldAuto = this._el("foldAutoBtn");
    if (foldAuto) foldAuto.textContent = this.settings.autoFolded ? "展开" : "收起";
  },

  _applySkin: function () {
    if (!this.root) return;
    const ice = this.settings && this.settings.panelSkin === "ice";
    this.root.setAttribute("data-skin", ice ? "ice" : "violet");
    const btn = this._el("skinBtn");
    if (btn) btn.title = ice ? "换壳：黑紫" : "换壳：白蓝";
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
    const existing = document.getElementById(TZ.HOST_ID);
    if (existing) existing.remove();
    this.host = null;
    this.root = null;

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
    this._applyVersion();
  },

  _applyVersion: function () {
    const el = this._el("verLine");
    if (!el) return;
    let v = "";
    try {
      v = (chrome.runtime.getManifest() || {}).version || "";
    } catch (err) {}
    el.textContent = v ? "v" + v : "";
  },

  _thresholdGrid: function (attr) {
    return `
            <div class="tz-grid">
              <div class="tz-field"><label>知了日销 ≥</label><input type="number" min="0" ${attr}="dailySalesMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了周销 ≥</label><input type="number" min="0" ${attr}="weeklySalesMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了月销 ≥</label><input type="number" min="0" ${attr}="monthlySalesMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>Temu 已售 ≥</label><input type="number" min="0" ${attr}="temuSoldMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了评分 ≥</label><input type="number" min="0" step="0.1" ${attr}="ratingMin" placeholder="空=不启用"></div>
              <div class="tz-field"><label>知了评论 ≥</label><input type="number" min="0" ${attr}="reviewMin" placeholder="空=不启用"></div>
              <div class="tz-field span2">
                <label>上架超过此时长就变灰（近 N 个月）</label>
                <input type="number" min="0" ${attr}="listedWithinValue" placeholder="空=不启用">
              </div>
            </div>`;
  },

  _presetBar: function (slot) {
    return `
            <div class="tz-preset" data-preset-slot="${slot}">
              <div class="tz-preset-row">
                <select data-preset-list="${slot}"></select>
                <button class="tz-btn ghost" type="button" data-act="presetApply" data-preset-slot="${slot}">填入</button>
              </div>
              <div class="tz-preset-row">
                <input type="text" data-preset-name="${slot}" placeholder="方案名称" maxlength="24">
                <button class="tz-btn ghost" type="button" data-act="presetSave" data-preset-slot="${slot}">存当前</button>
                <button class="tz-btn ghost" type="button" data-act="presetDel" data-preset-slot="${slot}">删除</button>
              </div>
            </div>
            <div class="tz-muted" data-preset-msg="${slot}"></div>`;
  },

  _html: function () {
    const ruleChecks = TZ.RULE_EXCLUSIONS.filter((r) => r.special !== "pcs" && r.special !== "priceAtMost")
      .map(
        (r) =>
          `<label class="tz-check"><input type="checkbox" data-ex="${r.id}"><span>${r.label}</span></label>`
      )
      .join("");
    const aoChecks = TZ.RULE_EXCLUSIONS.filter((r) => r.special !== "pcs" && r.special !== "priceAtMost")
      .map(
        (r) =>
          `<label class="tz-check"><input type="checkbox" data-ao-ex="${r.id}"><span>${r.label}</span></label>`
      )
      .join("");
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
        <div class="tz-chrome">
        <header class="tz-head">
          <div>
            <div class="tz-title">Temu × 知了筛选</div>
            <div class="tz-sub" data-el="verLine"></div>
          </div>
          <div class="tz-head-actions">
            <button class="tz-skin-btn" type="button" data-act="toggleSkin" data-el="skinBtn" title="换壳：白蓝">
              <span class="tz-skin-swatch" aria-hidden="true"></span>
            </button>
            <label class="tz-power" title="插件总开关">
              <input type="checkbox" data-el="pluginPower" checked>
              <span class="tz-power-track"><span class="tz-power-knob"></span></span>
            </label>
            <button class="tz-icon-btn" type="button" data-act="collapse" title="收起">–</button>
          </div>
        </header>
        <div class="tz-status">
          <span>已标灰 <b class="tz-pill" data-el="dimCount">0</b></span>
          <span class="tz-actions">
            <button class="tz-btn primary" type="button" data-act="saveRules">保存规则</button>
            <label class="tz-check"><input type="checkbox" data-el="pauseDim"><span>暂时取消变灰</span></label>
          </span>
        </div>
        </div>
        <div class="tz-body">
          <div class="tz-block" data-el="filterBlock">
            <div class="tz-block-title">
              <div class="tz-block-heading">
                筛选
                <span class="hint">两套数字为或 · 品类命中即灰</span>
              </div>
              <span class="tz-actions">
                <button class="tz-btn ghost" type="button" data-act="toggleFilterFold" data-el="foldFilterBtn">收起</button>
                <button class="tz-btn ghost" type="button" data-act="clearFilter">清空</button>
              </span>
            </div>
            <div class="tz-block-body">
            <div class="tz-muted" data-el="saveMeta">保存规则会连同自动点开的门槛、最多点开个数和间隔一起记住。</div>
            <label class="tz-check lead">
              <input type="checkbox" data-el="searchPageEnabled">
              <span>搜索页也筛选（默关）</span>
            </label>
            <div class="tz-pack">
              <div class="tz-pack-title">第一套数字</div>
              ${this._presetBar("thresholds")}
              ${this._thresholdGrid("data-th")}
            </div>
            <div class="tz-pack">
              <div class="tz-pack-title">第二套数字（过此套也可留下）</div>
              ${this._presetBar("thresholdsB")}
              ${this._thresholdGrid("data-th-b")}
            </div>
            <div class="tz-muted">两套之间是「或」：过其中一套数字门槛即可留下。每套内部仍是「并且」。某套全空则该套不启用。页面上销量为「-」或空的，跳过该条。品类命中仍变灰，数字救不回来。</div>
            <div class="tz-block-title tz-subhead">
              <div class="tz-block-heading">不看 / 不做（规则）</div>
              <button class="tz-btn ghost" type="button" data-act="checkAllEx">全选</button>
            </div>
            <div class="tz-field">
              <label>套装件数 &gt;（个 / 件 / pcs）</label>
              <input type="number" min="0" data-el="pcsOver" placeholder="空=不启用">
            </div>
            <div class="tz-field">
              <label>现价 ≤（$）</label>
              <input type="number" min="0" step="0.01" data-el="priceAtMost" placeholder="空=不启用">
            </div>
            <div class="tz-checks">${ruleChecks}</div>
            </div>
          </div>

          <div class="tz-block">
            <div class="tz-block-title">
              <div class="tz-block-heading">
                AI 分类
                <span class="hint">功能 B · 单独可关</span>
              </div>
            </div>
            <label class="tz-check lead"><input type="checkbox" data-el="aiEnabled"><span>启用 AI 分类（只补规则漏网）</span></label>
            <div class="tz-field stack">
              <label>Gemini API Key（只存扩展后台）</label>
              <div class="tz-row">
                <input type="password" data-el="apiKey" placeholder="AIza…" autocomplete="off">
                <button class="tz-btn ghost" type="button" data-act="saveKey">保存</button>
              </div>
              <div class="tz-muted" data-el="keyMeta">未保存密钥</div>
            </div>
            <div class="tz-checks">${aiChecks}</div>
            <div class="tz-muted" data-el="aiStatus"></div>
          </div>

          <div class="tz-block c-block" data-el="autoBlock">
            <div class="tz-block-title">
              <div class="tz-block-heading">
                自动点开
                <span class="hint">独立模块 C · 不参与变灰</span>
              </div>
              <span class="tz-actions">
                <button class="tz-btn ghost" type="button" data-act="toggleAutoFold" data-el="foldAutoBtn">收起</button>
                <button class="tz-btn ghost" type="button" data-act="clearAuto">清空筛选项</button>
              </span>
            </div>
            <div class="tz-block-body">
            <div class="tz-muted">点「开始」才跳转，刷新后不会自己点。下面几条只限制点谁，空=不限制，并且才点，不变灰。「保存规则」会一起记住。</div>
            ${this._presetBar("autoOpen")}
            <div class="tz-grid">
              <div class="tz-field"><label>只点日销 ≥</label><input type="number" min="0" data-el="autoDaily" placeholder="空=不限制"></div>
              <div class="tz-field"><label>只点月销 ≥</label><input type="number" min="0" data-el="autoMonthly" placeholder="空=不限制"></div>
              <div class="tz-field"><label>只点知了评分 ≥</label><input type="number" min="0" step="0.1" data-el="autoRating" placeholder="空=不限制"></div>
              <div class="tz-field"><label>只点知了评论 ≥</label><input type="number" min="0" data-el="autoReviews" placeholder="空=不限制"></div>
              <div class="tz-field span2"><label>只点 Temu 已售 ≥</label><input type="number" min="0" data-el="autoTemuSold" placeholder="空=不限制"></div>
              <div class="tz-field span2">
                <label>只点上架近 N 个月（超过则不点）</label>
                <input type="number" min="0" data-el="autoListed" placeholder="空=不限制">
              </div>
              <div class="tz-field"><label>最多点开 N 个</label><input type="number" min="1" data-el="autoMax"></div>
              <div class="tz-field"><label>两次间隔（秒）</label><input type="number" min="0.8" step="0.1" data-el="autoInterval"></div>
            </div>
            <div class="tz-block-title tz-subhead">
              <div class="tz-block-heading">不看 / 不做（只限制点开）</div>
              <button class="tz-btn ghost" type="button" data-act="checkAllAoEx">全选</button>
            </div>
            <div class="tz-muted">勾选后命中则不点，规则与上面筛选相同，不变灰。「保存规则」会一起记住。</div>
            <div class="tz-field">
              <label>套装件数 &gt;（个 / 件 / pcs）</label>
              <input type="number" min="0" data-el="autoPcsOver" placeholder="空=不限制">
            </div>
            <div class="tz-field">
              <label>现价 ≤（$）</label>
              <input type="number" min="0" step="0.01" data-el="autoPriceAtMost" placeholder="空=不限制">
            </div>
            <div class="tz-checks">${aoChecks}</div>
            <div class="tz-actions footer">
              <button class="tz-btn primary" type="button" data-act="aoStart">开始</button>
              <button class="tz-btn ghost" type="button" data-act="aoStop">停止</button>
            </div>
            <div class="tz-msg" data-el="aoMsg">没点开始时筛选只变灰，绝不跳转。</div>
            </div>
          </div>
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
      else if (act === "saveRules") {
        this._readForm();
        this.saveNow(true);
      } else if (act === "clearFilter") this._clearFilterFields();
      else if (act === "clearAuto") this._clearAutoFields();
      else if (act === "toggleFilterFold") {
        this.settings.filterFolded = !this.settings.filterFolded;
        this._applyFolds();
        this._persist();
      } else if (act === "toggleAutoFold") {
        this.settings.autoFolded = !this.settings.autoFolded;
        this._applyFolds();
        this._persist();
      } else if (act === "presetSave") this._presetSave(btn.getAttribute("data-preset-slot"));
      else if (act === "presetApply") this._presetApply(btn.getAttribute("data-preset-slot"));
      else if (act === "presetDel") this._presetDelete(btn.getAttribute("data-preset-slot"));
      else if (act === "checkAllEx") this._checkAll("[data-ex]");
      else if (act === "checkAllAoEx") this._checkAll("[data-ao-ex]");
      else if (act === "aoStart") TZ.autoOpen.start(this.settings);
      else if (act === "aoStop") TZ.autoOpen.stop();
      else if (act === "toggleSkin") {
        this.settings.panelSkin = this.settings.panelSkin === "ice" ? "violet" : "ice";
        this._applySkin();
        this._persist();
      }
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

  _checkAll: function (sel) {
    this.root.querySelectorAll(sel).forEach((box) => {
      box.checked = true;
    });
    this._readForm();
  },

  _clearFilterFields: function () {
    this.root.querySelectorAll("[data-th], [data-th-b]").forEach((input) => {
      input.value = "";
    });
    this.root.querySelectorAll("[data-ex]").forEach((box) => {
      box.checked = false;
    });
    const pcsOver = this._el("pcsOver");
    if (pcsOver) pcsOver.value = "";
    const priceAtMost = this._el("priceAtMost");
    if (priceAtMost) priceAtMost.value = "";
    this._readForm();
    this.saveNow(true);
  },

  _clearAutoFields: function () {
    ["autoDaily", "autoMonthly", "autoRating", "autoReviews", "autoTemuSold", "autoListed", "autoPcsOver", "autoPriceAtMost"].forEach((name) => {
      const el = this._el(name);
      if (el) el.value = "";
    });
    this.root.querySelectorAll("[data-ao-ex]").forEach((box) => {
      box.checked = false;
    });
    this._readForm();
    this.saveNow(true);
  },

  _readForm: function () {
    const s = this.settings;
    s.searchPageEnabled = this._el("searchPageEnabled").checked;
    s.pauseDim = this._el("pauseDim").checked;
    s.ai.enabled = this._el("aiEnabled").checked;
    s.autoOpen.maxCount = TZ.emptyNum(this._el("autoMax").value) || 10;
    s.autoOpen.intervalSec = TZ.emptyNum(this._el("autoInterval").value) || 2.5;
    const autoDaily = this._el("autoDaily");
    const autoMonthly = this._el("autoMonthly");
    const autoRating = this._el("autoRating");
    const autoReviews = this._el("autoReviews");
    const autoTemuSold = this._el("autoTemuSold");
    const autoListed = this._el("autoListed");
    if (autoDaily) s.autoOpen.dailySalesMin = TZ.emptyNum(autoDaily.value);
    if (autoMonthly) s.autoOpen.monthlySalesMin = TZ.emptyNum(autoMonthly.value);
    if (autoRating) s.autoOpen.ratingMin = TZ.emptyNum(autoRating.value);
    if (autoReviews) s.autoOpen.reviewMin = TZ.emptyNum(autoReviews.value);
    if (autoTemuSold) s.autoOpen.temuSoldMin = TZ.emptyNum(autoTemuSold.value);
    if (autoListed) s.autoOpen.listedWithinValue = TZ.emptyNum(autoListed.value);
    s.autoOpen.listedWithinUnit = "month";
    const autoPcsOver = this._el("autoPcsOver");
    if (autoPcsOver) s.autoOpen.pcsOver = TZ.emptyNum(autoPcsOver.value);
    const pcsOver = this._el("pcsOver");
    if (pcsOver) s.pcsOver = TZ.emptyNum(pcsOver.value);
    const autoPriceAtMost = this._el("autoPriceAtMost");
    if (autoPriceAtMost) s.autoOpen.priceAtMost = TZ.emptyNum(autoPriceAtMost.value);
    const priceAtMost = this._el("priceAtMost");
    if (priceAtMost) s.priceAtMost = TZ.emptyNum(priceAtMost.value);

    const th = s.thresholds;
    this.root.querySelectorAll("[data-th]").forEach((input) => {
      th[input.getAttribute("data-th")] = TZ.emptyNum(input.value);
    });
    th.listedWithinUnit = "month";

    if (!s.thresholdsB) s.thresholdsB = {};
    const thB = s.thresholdsB;
    this.root.querySelectorAll("[data-th-b]").forEach((input) => {
      thB[input.getAttribute("data-th-b")] = TZ.emptyNum(input.value);
    });
    thB.listedWithinUnit = "month";

    s.exclusions = {};
    this.root.querySelectorAll("[data-ex]").forEach((box) => {
      s.exclusions[box.getAttribute("data-ex")] = box.checked;
    });
    s.aiExclusions = {};
    this.root.querySelectorAll("[data-ai-ex]").forEach((box) => {
      s.aiExclusions[box.getAttribute("data-ai-ex")] = box.checked;
    });
    if (!s.autoOpen.exclusions) s.autoOpen.exclusions = {};
    this.root.querySelectorAll("[data-ao-ex]").forEach((box) => {
      s.autoOpen.exclusions[box.getAttribute("data-ao-ex")] = box.checked;
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
      ? "已保存筛选和自动点开设置，下次打开 Temu 会自动加载。" + (time ? "（" + time + "）" : "")
      : time
        ? "已自动记住当前规则（" + time + "）"
        : "保存规则会连同自动点开的门槛、最多点开个数和间隔一起记住。";
  },

  _presetMsg: function (slot, text) {
    const el = this.root.querySelector('[data-preset-msg="' + slot + '"]');
    if (el) el.textContent = text || "";
  },

  _refreshPresetSelects: function (keep) {
    if (!this.root || !TZ.presets) return;
    ["thresholds", "thresholdsB", "autoOpen"].forEach((slot) => {
      const sel = this.root.querySelector('[data-preset-list="' + slot + '"]');
      TZ.presets.fillSelect(sel, this.settings, slot, keep && keep[slot]);
    });
  },

  _presetSave: function (slot) {
    if (!slot || !TZ.presets) return;
    const input = this.root.querySelector('[data-preset-name="' + slot + '"]');
    const name = input ? input.value : "";
    const res = TZ.presets.save(this.settings, slot, name, TZ.presets.collect(this.root, slot));
    if (!res.ok) {
      this._presetMsg(slot, res.reason);
      return;
    }
    this._refreshPresetSelects({ [slot]: res.id });
    this._presetMsg(slot, res.replaced ? "已覆盖同名方案" : "已保存方案");
    this._persist();
  },

  _presetApply: function (slot) {
    if (!slot || !TZ.presets) return;
    const sel = this.root.querySelector('[data-preset-list="' + slot + '"]');
    const id = sel && sel.value;
    const item = TZ.presets.find(this.settings, slot, id);
    if (!item) {
      this._presetMsg(slot, "请先选择已存方案");
      return;
    }
    TZ.presets.apply(this.root, slot, item.data);
    this._readForm();
    this._presetMsg(slot, "已填入「" + item.name + "」");
  },

  _presetDelete: function (slot) {
    if (!slot || !TZ.presets) return;
    const sel = this.root.querySelector('[data-preset-list="' + slot + '"]');
    const id = sel && sel.value;
    if (!id) {
      this._presetMsg(slot, "请先选择要删除的方案");
      return;
    }
    TZ.presets.remove(this.settings, slot, id);
    this._refreshPresetSelects();
    this._presetMsg(slot, "已删除");
    this._persist();
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
    this._applyFolds();
    this._el("searchPageEnabled").checked = !!settings.searchPageEnabled;
    this._el("pauseDim").checked = !!settings.pauseDim;
    this._el("aiEnabled").checked = !!(settings.ai && settings.ai.enabled);
    this._el("autoMax").value = settings.autoOpen.maxCount;
    this._el("autoInterval").value = settings.autoOpen.intervalSec;
    const autoDaily = this._el("autoDaily");
    if (autoDaily) autoDaily.value = settings.autoOpen.dailySalesMin == null ? "" : settings.autoOpen.dailySalesMin;
    const autoMonthly = this._el("autoMonthly");
    if (autoMonthly) autoMonthly.value = settings.autoOpen.monthlySalesMin == null ? "" : settings.autoOpen.monthlySalesMin;
    const autoRating = this._el("autoRating");
    if (autoRating) autoRating.value = settings.autoOpen.ratingMin == null ? "" : settings.autoOpen.ratingMin;
    const autoReviews = this._el("autoReviews");
    if (autoReviews) autoReviews.value = settings.autoOpen.reviewMin == null ? "" : settings.autoOpen.reviewMin;
    const autoTemuSold = this._el("autoTemuSold");
    if (autoTemuSold) autoTemuSold.value = settings.autoOpen.temuSoldMin == null ? "" : settings.autoOpen.temuSoldMin;
    const autoListed = this._el("autoListed");
    if (autoListed) autoListed.value = settings.autoOpen.listedWithinValue == null ? "" : settings.autoOpen.listedWithinValue;

    const th = settings.thresholds || {};
    this.root.querySelectorAll("[data-th]").forEach((input) => {
      const key = input.getAttribute("data-th");
      const v = th[key];
      input.value = v == null ? "" : v;
    });

    const thB = settings.thresholdsB || {};
    this.root.querySelectorAll("[data-th-b]").forEach((input) => {
      const key = input.getAttribute("data-th-b");
      const v = thB[key];
      input.value = v == null ? "" : v;
    });

    const pcsOverEl = this._el("pcsOver");
    if (pcsOverEl) pcsOverEl.value = settings.pcsOver == null ? "" : settings.pcsOver;
    const autoPcsOverEl = this._el("autoPcsOver");
    if (autoPcsOverEl) {
      const aoP = settings.autoOpen && settings.autoOpen.pcsOver;
      autoPcsOverEl.value = aoP == null ? "" : aoP;
    }
    const priceAtMostEl = this._el("priceAtMost");
    if (priceAtMostEl) priceAtMostEl.value = settings.priceAtMost == null ? "" : settings.priceAtMost;
    const autoPriceAtMostEl = this._el("autoPriceAtMost");
    if (autoPriceAtMostEl) {
      const aoPr = settings.autoOpen && settings.autoOpen.priceAtMost;
      autoPriceAtMostEl.value = aoPr == null ? "" : aoPr;
    }

    this.root.querySelectorAll("[data-ex]").forEach((box) => {
      box.checked = !!(settings.exclusions && settings.exclusions[box.getAttribute("data-ex")]);
    });
    this.root.querySelectorAll("[data-ai-ex]").forEach((box) => {
      box.checked = !!(settings.aiExclusions && settings.aiExclusions[box.getAttribute("data-ai-ex")]);
    });
    const aoEx = (settings.autoOpen && settings.autoOpen.exclusions) || {};
    this.root.querySelectorAll("[data-ao-ex]").forEach((box) => {
      box.checked = !!aoEx[box.getAttribute("data-ao-ex")];
    });

    this._refreshPresetSelects();
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
