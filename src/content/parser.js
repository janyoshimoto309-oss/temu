var TZ = TZ || {};

TZ.normalizeDigits = function (raw) {
  return String(raw == null ? "" : raw).replace(/[０-９]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  });
};

TZ.isBlankMetric = function (raw) {
  if (raw == null) return true;
  const s = TZ.normalizeDigits(raw).trim();
  return !s || /^[-—–－_]+$/.test(s) || /^(n\/?a|无|暂无|空|null|undefined)$/i.test(s);
};

TZ.parseCount = function (raw) {
  if (TZ.isBlankMetric(raw)) return null;
  let s = TZ.normalizeDigits(raw).trim();
  s = s.replace(/件/g, "").replace(/,/g, "").trim();
  const m = s.match(/^([\d.]+)\s*(万|w)?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 10000;
  return n;
};

TZ.parseListedAge = function (raw) {
  if (TZ.isBlankMetric(raw)) return { missing: true, days: null, months: null };
  const s = TZ.normalizeDigits(raw).replace(/\s+/g, "").replace(/以前/g, "前");
  if (/刚刚|今天|今日|刚才|刚刚上架/.test(s)) return { missing: false, days: 0, months: 0 };

  let m = s.match(/(\d+(?:\.\d+)?)\+?年前/);
  if (m) {
    const n = parseFloat(m[1]);
    return { missing: false, days: Math.round(n * 365), months: n * 12 };
  }
  m = s.match(/(\d+(?:\.\d+)?)\+?个?月前/);
  if (m) {
    const n = parseFloat(m[1]);
    return { missing: false, days: Math.round(n * 30), months: n };
  }
  m = s.match(/(\d+)周前/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { missing: false, days: n * 7, months: (n * 7) / 30 };
  }
  m = s.match(/(\d+)(天|日)前/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { missing: false, days: n, months: n / 30 };
  }
  m = s.match(/(\d+)小时/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { missing: false, days: n / 24, months: n / 24 / 30 };
  }
  m = s.match(/(\d+)(?:years?|yrs?)ago/i);
  if (m) {
    const n = parseFloat(m[1]);
    return { missing: false, days: Math.round(n * 365), months: n * 12 };
  }
  m = s.match(/(\d+)months?ago/i);
  if (m) {
    const n = parseFloat(m[1]);
    return { missing: false, days: Math.round(n * 30), months: n };
  }
  m = s.match(/(\d+)days?ago/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return { missing: false, days: n, months: n / 30 };
  }

  const abs = s.match(/(\d{4})[年/\-.](\d{1,2})(?:[月/\-.](\d{1,2}))?/);
  if (abs) {
    const d = new Date(parseInt(abs[1], 10), parseInt(abs[2], 10) - 1, abs[3] ? parseInt(abs[3], 10) : 1);
    if (!Number.isNaN(d.getTime())) {
      const days = Math.max(0, (Date.now() - d.getTime()) / 86400000);
      return { missing: false, days: days, months: days / 30 };
    }
  }
  return { missing: true, days: null, months: null };
};

TZ.parseListedAgeDays = function (raw) {
  const age = TZ.parseListedAge(raw);
  return age.missing ? null : age.days;
};

TZ.productHref = function (anchor) {
  if (!anchor) return "";
  const href = anchor.getAttribute("href") || anchor.href || "";
  if (!href || href === "#" || href.startsWith("javascript:")) return "";
  try {
    return new URL(href, location.origin).href;
  } catch (e) {
    return href;
  }
};

TZ.isProductHref = function (href) {
  if (!href) return false;
  const h = href.toLowerCase();
  if (!h.includes("temu.com") && !h.startsWith("/") && !h.startsWith("http")) {
    return /goods|g-\d+/.test(h);
  }
  return (
    /\/goods\.html/.test(h) ||
    /goods_id=/.test(h) ||
    /\/g-\d+/.test(h) ||
    /-\g-\d+/.test(h) ||
    /\/bg-\d+/.test(h)
  );
};

TZ.goodsIdFromHref = function (href) {
  if (!href) return "";
  const m1 = String(href).match(/goods_id=(\d+)/i);
  if (m1) return m1[1];
  const m2 = String(href).match(/[^\w]g-?(\d{6,})/i);
  if (m2) return m2[1];
  const m3 = String(href).match(/-g-(\d+)/i);
  return m3 ? m3[1] : "";
};

TZ.composedParent = function (el) {
  if (!el) return null;
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode && el.getRootNode();
  if (root && root.host) return root.host;
  return null;
};

TZ._shadowMemo = null;

TZ.beginScan = function () {
  TZ._shadowMemo = new WeakMap();
};

TZ.endScan = function () {
  TZ._shadowMemo = null;
};

TZ.openShadow = function (el) {
  if (!el || el.nodeType !== 1) return null;
  if (TZ._shadowMemo && TZ._shadowMemo.has(el)) return TZ._shadowMemo.get(el);
  let sr = null;
  try {
    if (typeof chrome !== "undefined" && chrome.dom && chrome.dom.openOrClosedShadowRoot) {
      sr = chrome.dom.openOrClosedShadowRoot(el) || el.shadowRoot || null;
    } else {
      sr = el.shadowRoot || null;
    }
  } catch (err) {
    sr = el.shadowRoot || null;
  }
  if (TZ._shadowMemo) TZ._shadowMemo.set(el, sr);
  return sr;
};

TZ.deepInnerText = function (el) {
  if (!el) return "";
  const parts = [];
  const visit = function (node) {
    if (!node) return;
    if (node.id === TZ.HOST_ID) return;
    if (node.nodeType === 3) {
      const v = node.nodeValue && node.nodeValue.trim();
      if (v) parts.push(v);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) visit(kids[i]);
    if (node.nodeType === 1) {
      const sr = TZ.openShadow(node);
      if (sr) visit(sr);
    }
  };
  visit(el);
  return parts.join(" ");
};

TZ.extractListedRaw = function (text) {
  const t = TZ.normalizeDigits(String(text || "").replace(/\u00a0/g, " ")).replace(/开店时间\s*[:：]?[^\n]*/g, "");
  const m = t.match(
    /上架时间\s*[:：]?\s*(?:约|大概)?\s*(\d+(?:\.\d+)?\s*个?月\s*前|\d+(?:\.\d+)?\s*年\s*前|\d+\s*周\s*前|\d+\s*(?:天|日)\s*前)/
  );
  if (m) return m[1].replace(/\s+/g, "");
  const m2 = t.match(/上架时间[\s\S]{0,12}?(\d+(?:\.\d+)?)(年|个?月|周|天|日)\s*前/);
  if (m2) return (m2[1] + m2[2] + "前").replace(/\s+/g, "");
  return "";
};

TZ._cutShopBlock = function (text) {
  const t = String(text || "").replace(/\u00a0/g, " ");
  const catAt = t.search(/品类\s*[:：]/);
  const from = catAt >= 0 ? catAt : 0;
  const shopAt = t.indexOf("店铺", from);
  if (shopAt > 0) return t.slice(0, shopAt);
  const shop2 = t.search(/店铺\s*(名|类型|铺名)/);
  if (shop2 > 0) return t.slice(0, shop2);
  return t;
};

TZ.parseRatingReviews = function (text) {
  const out = { rating: null, reviews: null };
  if (!text) return out;
  const src = String(text);
  const start = src.search(/评分\s*[\/／]?\s*评论数/);
  if (start < 0) return out;
  const slice = src.slice(start, start + 96).replace(/品类[\s\S]*$/, "");
  const nums = [];
  const re = /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(slice)) && nums.length < 3) nums.push(m[1]);
  if (!nums.length) return out;
  const first = TZ.parseCount(nums[0]);
  if (first != null && first <= 5.5) {
    out.rating = first;
    if (nums[1] != null) out.reviews = TZ.parseCount(nums[1]);
  } else if (first != null) {
    out.reviews = first;
  }
  return out;
};

TZ._fieldAfter = function (text, labels) {
  for (let i = 0; i < labels.length; i++) {
    const re = new RegExp(labels[i] + "\\s*[:：]?\\s*([^\\n]+)");
    const m = text.match(re);
    if (!m) continue;
    return m[1].replace(/评分.*$|评论.*$|品类.*$|总销售.*$|销量.*$/, "").trim();
  }
  return "";
};

TZ.parseZhiliaoText = function (text) {
  const result = {
    present: false,
    daily: null,
    weekly: null,
    monthly: null,
    listedRaw: "",
    listedDays: null,
    listedMonths: null,
    rating: null,
    reviews: null,
    category: ""
  };
  if (!text) return result;
  if (text.includes("知了数据") || text.includes("上架时间") || /销量\s*[:：]/.test(text)) {
    result.present = true;
  }
  if (!result.present) return result;

  const productBlock = TZ._cutShopBlock(text);

  const salesLineMatch = productBlock.match(/销量[^\n]*/);
  const salesLine = salesLineMatch ? salesLineMatch[0] : productBlock;
  const daily = salesLine.match(/日\s*[:：]?\s*([^\s周]+)/);
  const weekly = salesLine.match(/周\s*[:：]?\s*([^\s月]+)/);
  const monthly = salesLine.match(/月\s*[:：]?\s*([^\s\n总上评品]+)/);
  if (daily) result.daily = TZ.parseCount(daily[1]);
  if (weekly) result.weekly = TZ.parseCount(weekly[1]);
  if (monthly) result.monthly = TZ.parseCount(monthly[1]);

  result.listedRaw = TZ.extractListedRaw(productBlock) || TZ.extractListedRaw(text) || TZ._fieldAfter(productBlock, ["上架时间", "上架"]);
  const age = TZ.parseListedAge(result.listedRaw);
  if (!age.missing) {
    result.listedDays = age.days;
    result.listedMonths = age.months;
  }

  const rr = TZ.parseRatingReviews(productBlock);
  result.rating = rr.rating;
  result.reviews = rr.reviews;

  const cat = productBlock.match(/品类\s*[:：]\s*([^\n]+)/);
  if (cat) result.category = cat[1].replace(/店铺.*$/, "").trim();

  return result;
};

TZ.parseSalePrice = function (text) {
  if (!text) return null;
  let t = String(text).replace(/\u00a0/g, " ");
  t = t.replace(/今天支付\s*\$?\s*\d+\.\d{2}/g, "");
  t = t.replace(/今日支付\s*\$?\s*\d+\.\d{2}/g, "");
  t = t.replace(/抵用金[\s\S]{0,16}\$\d+\.\d{2}/g, "");
  t = t.replace(/\$\d+\.\d{2}\s*抵用金/g, "");
  t = t.replace(/赔付\$\d+\.\d{2}/g, "");
  t = t.replace(/超时赔付[^\d$]{0,12}\$\d+\.\d{2}/g, "");
  const prices = [];
  const re = /\$(\d+)\.(\d{2})/g;
  let m;
  while ((m = re.exec(t))) {
    const n = parseFloat(m[1] + "." + m[2]);
    if (Number.isFinite(n) && n > 0 && n <= 2000) prices.push(n);
  }
  if (!prices.length) return null;
  prices.sort(function (a, b) {
    return a - b;
  });
  return prices[0];
};

TZ.parsePriceNumber = function (raw) {
  if (raw == null || raw === "") return null;
  let s = TZ.normalizeDigits(String(raw)).replace(/,/g, "").replace(/\u00a0/g, " ").trim();
  s = s.replace(/US\$/gi, "$");
  const m = s.match(/[\$€£¥￥]?\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

TZ.formatHalfPrice = function (price) {
  const n = typeof price === "number" ? price : TZ.parsePriceNumber(price);
  if (n == null) return "";
  return (n / 2).toFixed(2);
};

TZ.parseTemuSold = function (text) {
  if (!text) return null;
  const m =
    text.match(/已售\s*([\d,.]+)\s*(万)?\s*件/) ||
    text.match(/Sold\s*([\d,.]+)\s*(k|K|万)?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (m[2] && /万/i.test(m[2])) n *= 10000;
  if (m[2] && /^k$/i.test(m[2])) n *= 1000;
  return n;
};

TZ.parsePcsCount = function (title) {
  if (!title) return null;
  const s = TZ.normalizeDigits(title);
  const pcs = s.match(/(\d+)\s*pcs\b/i);
  if (pcs) return parseInt(pcs[1], 10);
  const jian = s.match(/(\d+)\s*件/);
  if (jian) return parseInt(jian[1], 10);
  const ge = s.match(/(\d+)\s*个(?!月)/);
  if (ge) return parseInt(ge[1], 10);
  return null;
};

TZ.innerTextSkip = function (root, skipEl) {
  if (!root) return "";
  if (!skipEl || !root.contains(skipEl)) return (root.innerText || root.textContent || "").trim();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (skipEl.contains(node)) return NodeFilter.FILTER_REJECT;
      const v = node.nodeValue && node.nodeValue.trim();
      return v ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const parts = [];
  while (walker.nextNode()) parts.push(walker.currentNode.nodeValue.trim());
  return parts.join(" ");
};

TZ.parseCard = function (card, zhiliaoEl) {
  const cardText = TZ.deepInnerText(card);
  const zInside = !!(zhiliaoEl && card && (zhiliaoEl === card || (card.contains && card.contains(zhiliaoEl))));
  const zText = zhiliaoEl && !zInside ? TZ.deepInnerText(zhiliaoEl) : "";
  const zhiliao = TZ.parseZhiliaoText(zText && (zText.includes("上架时间") || zText.includes("知了数据")) ? zText : cardText);
  if (!zhiliao.listedRaw) {
    const listed = TZ.extractListedRaw(cardText);
    if (listed) {
      zhiliao.listedRaw = listed;
      const age = TZ.parseListedAge(listed);
      if (!age.missing) {
        zhiliao.listedDays = age.days;
        zhiliao.listedMonths = age.months;
      }
      zhiliao.present = true;
    }
  }
  const sold = TZ.parseTemuSold(cardText);
  const temuText = zhiliaoEl ? TZ.innerTextSkip(card, zhiliaoEl) : cardText;
  const price = TZ.parseSalePrice(temuText);

  let href = "";
  let goodsId = "";
  const anchors = card.querySelectorAll("a[href]");
  for (const a of anchors) {
    const h = TZ.productHref(a);
    if (TZ.isProductHref(h)) {
      href = h;
      goodsId = TZ.goodsIdFromHref(h);
      break;
    }
  }

  let title = "";
  const headings = card.querySelectorAll("h1, h2, h3, h4");
  for (const h of headings) {
    if (zhiliaoEl && zhiliaoEl.contains(h)) continue;
    const t = (h.innerText || "").trim();
    if (t && t.length >= 4 && !t.includes("知了数据")) {
      title = t.split("\n")[0].trim();
      break;
    }
  }
  if (!title) {
    for (const a of anchors) {
      if (zhiliaoEl && zhiliaoEl.contains(a)) continue;
      const t = (a.innerText || a.getAttribute("title") || a.getAttribute("aria-label") || "").trim();
      if (t && t.length >= 6 && !t.includes("知了数据") && !/^\$/.test(t) && !t.includes("已售")) {
        title = t.split("\n")[0].trim();
        if (title.length > 8) break;
      }
    }
  }

  let imageUrl = "";
  const imgs = card.querySelectorAll("img");
  for (const img of imgs) {
    if (zhiliaoEl && zhiliaoEl.contains(img)) continue;
    const src = img.currentSrc || img.src || img.getAttribute("src") || "";
    if (!src || src.startsWith("data:")) continue;
    const w = img.naturalWidth || img.width || 0;
    if (w && w < 40) continue;
    imageUrl = src;
    break;
  }

  const isAd = TZ.isAdCard(card, zhiliaoEl);

  return {
    card: card,
    zhiliaoEl: zhiliaoEl || null,
    zhiliao: zhiliao,
    title: title,
    sold: sold,
    price: price,
    href: href,
    goodsId: goodsId,
    imageUrl: imageUrl,
    isAd: isAd,
    hasCustomBadge: TZ.hasCustomBadge(card, zhiliaoEl),
    hasBrandLabel: TZ.hasBrandLabel(card, zhiliaoEl),
    pcs: TZ.parsePcsCount(title)
  };
};

TZ.CUSTOM_BADGE_RE = /^(定制|訂製|订制)$/;
TZ.BRAND_LABEL_RE = /^(品牌官方店|品牌旗舰店|品牌店|品牌)\s*[:：]/;
TZ.BRAND_LABEL_EN_RE = /^brand(\s*official(\s*store)?)?\s*[:：]/i;

TZ.hasCustomBadge = function (card, zhiliaoEl) {
  if (!card || !card.querySelectorAll) return false;

  let imgRect = null;
  const imgs = card.querySelectorAll("img");
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    if (zhiliaoEl && zhiliaoEl.contains(img)) continue;
    const alt = (img.getAttribute("alt") || img.getAttribute("aria-label") || "").replace(/\s+/g, "");
    if (TZ.CUSTOM_BADGE_RE.test(alt)) {
      const ir = img.getBoundingClientRect ? img.getBoundingClientRect() : null;
      if (!ir || ir.width < 80) return true;
    }
    if (!imgRect && img.getBoundingClientRect) {
      const r = img.getBoundingClientRect();
      if (r.width >= 40 && r.height >= 40) imgRect = r;
    }
  }

  const els = card.querySelectorAll("span, div, em, i, p, label, b, strong, font, a");
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (zhiliaoEl && zhiliaoEl.contains(el)) continue;
    let own = "";
    const kids = el.childNodes;
    for (let j = 0; j < kids.length; j++) {
      if (kids[j].nodeType === 3) own += kids[j].nodeValue || "";
    }
    const t = own.replace(/\s+/g, "").trim();
    const aria = (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("alt") || "")) || "";
    const ariaT = String(aria).replace(/\s+/g, "").trim();
    const hit = TZ.CUSTOM_BADGE_RE.test(t) || TZ.CUSTOM_BADGE_RE.test(ariaT);
    if (!hit) continue;
    if (!imgRect || !el.getBoundingClientRect) return true;
    const br = el.getBoundingClientRect();
    if (!br.width && !br.height) return true;
    const cx = br.left + br.width / 2;
    const cy = br.top + br.height / 2;
    const inLeft = cx >= imgRect.left - 12 && cx <= imgRect.left + imgRect.width * 0.5;
    const inTop = cy >= imgRect.top - 12 && cy <= imgRect.top + imgRect.height * 0.45;
    if (inLeft && inTop) return true;
  }
  return false;
};

TZ.hasBrandLabel = function (card, zhiliaoEl) {
  if (!card || !card.querySelectorAll) return false;
  const els = card.querySelectorAll("span, div, em, i, p, label, b, strong, font, a");
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (zhiliaoEl && zhiliaoEl.contains(el)) continue;
    if (/^H[1-4]$/i.test(el.tagName)) continue;
    const raw = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (!raw || raw.length > 48) continue;
    if (raw.indexOf("知了") >= 0 || raw.indexOf("已售") >= 0 || raw.indexOf("销量") >= 0) continue;
    const line = raw.split("\n")[0].trim();
    if (TZ.BRAND_LABEL_RE.test(line) || TZ.BRAND_LABEL_EN_RE.test(line)) return true;
  }
  return false;
};

TZ.isAdCard = function (card, zhiliaoEl) {
  const els = card.querySelectorAll("span, div, em, i, p, img");
  for (const el of els) {
    if (zhiliaoEl && zhiliaoEl.contains(el)) continue;
    const t = (el.innerText || el.getAttribute("alt") || el.getAttribute("aria-label") || "").trim();
    if (t === "广告" || t === "Ad" || t === "Sponsored" || t === "广告商品") return true;
    if (t.length <= 6 && /广告/.test(t)) return true;
  }
  return false;
};
