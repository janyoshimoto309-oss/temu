var TZ = TZ || {};

TZ.pageScope = {
  kind: "browse",

  classify: function (href) {
    const url = new URL(href || location.href, location.origin);
    const path = (url.pathname || "").toLowerCase();
    const search = url.search || "";

    if (
      /\/mall(\b|\/|\.html)/.test(path) ||
      /\/store(\b|\/|\.html)/.test(path) ||
      /\/shop(\b|\/|\.html)/.test(path) ||
      /channel\/mall/.test(path)
    ) {
      return "shop";
    }

    const isGoodsPath =
      /\/goods\.html/.test(path) ||
      /\/g-\d+/.test(path) ||
      /-\g-\d+/.test(path) ||
      /\/product\.html/.test(path);
    const hasGoodsQuery = /[?&]goods_id=/.test(search);
    const isListPath =
      path === "/" ||
      path.includes("search") ||
      path.includes("category") ||
      path.includes("channel") ||
      path.endsWith("/home.html");

    if ((isGoodsPath || hasGoodsQuery) && !isListPath) return "detail";

    if (
      path.includes("search_result") ||
      path.includes("search.html") ||
      /[?&]search_key=/.test(search) ||
      /[?&]q=/.test(search) && path.includes("search")
    ) {
      return "search";
    }

    return "browse";
  },

  refresh: function () {
    this.kind = this.classify(location.href);
    return this.kind;
  },

  allowFilter: function (settings) {
    const kind = this.refresh();
    if (kind === "shop") return false;
    if (kind === "detail") return false;
    if (kind === "search") return !!(settings && settings.searchPageEnabled);
    return true;
  },

  isUiChrome: function (el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    let n = el;
    let hops = 0;
    while (n && n !== document.body && hops < 16) {
      let pos = "";
      try {
        pos = window.getComputedStyle(n).position;
      } catch (e) {
        pos = "";
      }
      if (pos === "fixed" || pos === "sticky") {
        const r = n.getBoundingClientRect();
        if (r.height > 0 && r.height < 220 && (r.top < 96 || r.bottom > window.innerHeight - 96)) {
          return true;
        }
      }
      n = n.parentElement;
      hops += 1;
    }
    if (!el.getBoundingClientRect) return false;
    const box = el.getBoundingClientRect();
    if (box.top < 10 && box.width > window.innerWidth * 0.72 && box.height > 28 && box.height < 180) {
      return true;
    }
    const t = String(el.textContent || "");
    if (t.length < 4000 && t.indexOf("畅销商品") >= 0 && (t.indexOf("本地仓库") >= 0 || t.indexOf("订单和账户") >= 0)) {
      return true;
    }
    return false;
  }
};
