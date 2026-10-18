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
    if (kind === "detail" || kind === "shop") return false;
    if (kind === "search") return !!(settings && settings.searchPageEnabled);
    return true;
  }
};
