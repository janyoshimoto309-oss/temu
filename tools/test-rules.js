const fs = require("fs");
const vm = require("vm");
const path = require("path");
const root = path.join(__dirname, "..");
const ctx = {
  TZ: {},
  document: {},
  NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  URL,
  location: { origin: "https://www.temu.com/", href: "https://www.temu.com/" }
};
vm.createContext(ctx);
function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx);
}
load("src/shared/constants.js");
load("src/shared/storage.js");
load("src/content/parser.js");
load("src/content/filter-engine.js");
const T = ctx.TZ;
let fail = 0;

function eq(name, got, expected) {
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    console.log("FAIL", name, got, expected);
    fail += 1;
  }
}

function settings(over) {
  const s = JSON.parse(JSON.stringify(T.DEFAULT_SETTINGS));
  if (over && over.thresholds) Object.assign(s.thresholds, over.thresholds);
  if (over && over.thresholdsB) Object.assign(s.thresholdsB, over.thresholdsB);
  if (over && over.exclusions) s.exclusions = over.exclusions;
  if (over && over.pcsOver != null) s.pcsOver = over.pcsOver;
  if (over && over.priceAtMost != null) s.priceAtMost = over.priceAtMost;
  return s;
}

function card(zOver, extra) {
  const z = {
    present: true,
    daily: 80,
    weekly: 400,
    monthly: 200,
    listedRaw: "2个月前",
    listedDays: 60,
    listedMonths: 2,
    rating: 4.8,
    reviews: 100,
    category: "手机支架"
  };
  Object.assign(z, zOver || {});
  return Object.assign({ title: "Phone holder", sold: 5000, pcs: null, zhiliao: z }, extra || {});
}

eq("brand re 品牌", T.BRAND_LABEL_RE.test("品牌: 环球"), true);
eq("brand re 官方店", T.BRAND_LABEL_RE.test("品牌官方店: CLOHOO"), true);
eq("brand re not title", T.BRAND_LABEL_RE.test("男士运动鞋品牌鞋"), false);

eq("pack empty", T.packEnabled(T.DEFAULT_SETTINGS.thresholds), false);
eq("pack daily", T.packEnabled({ dailySalesMin: 50 }), true);

let v = T.evaluateRules(
  card(),
  settings({ thresholds: { dailySalesMin: 50, monthlySalesMin: 122 }, thresholdsB: { dailySalesMin: 200 } })
);
eq("pass pack1 only dim", v.dim, false);

v = T.evaluateRules(
  card(),
  settings({ thresholds: { dailySalesMin: 200 }, thresholdsB: { dailySalesMin: 50 } })
);
eq("pass pack2 only dim", v.dim, false);

v = T.evaluateRules(
  card(),
  settings({ thresholds: { dailySalesMin: 200 }, thresholdsB: { monthlySalesMin: 500 } })
);
eq("fail both dim", v.dim, true);
if (!v.reasons.some((r) => String(r).indexOf("套1") >= 0) || !v.reasons.some((r) => String(r).indexOf("套2") >= 0)) {
  console.log("FAIL fail both reasons", v.reasons);
  fail += 1;
}

v = T.evaluateRules(
  card({ category: "女装连衣裙" }),
  settings({
    thresholds: { dailySalesMin: 200 },
    thresholdsB: { dailySalesMin: 50 },
    exclusions: { clothing: true }
  })
);
eq("category beats pack2 dim", v.dim, true);
if (!v.reasons.some((r) => String(r).indexOf("品类") >= 0)) {
  console.log("FAIL category reason", v.reasons);
  fail += 1;
}

v = T.evaluateRules(
  card({ category: "女士内衣、睡衣和家居服" }, { title: "女士四季圆领迷你时尚简约性感" }),
  settings({ exclusions: { clothing: true } })
);
eq("sleepwear category dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "手机支架" }, { title: "女士四季圆领迷你时尚简约性感" }),
  settings({ exclusions: { clothing: true } })
);
eq("round neck title dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "家电" }, { title: "全自动洗衣机10kg" }),
  settings({ exclusions: { clothing: true } })
);
eq("washer not clothing", v.dim, false);

v = T.evaluateRules(card(), settings({ thresholds: { dailySalesMin: 200 } }));
eq("empty pack2 does not rescue", v.dim, true);

v = T.evaluateRules(
  card({ listedRaw: "3个月前", listedMonths: 3, listedDays: 90 }),
  settings({ thresholds: { listedWithinValue: 3, listedWithinUnit: "month" } })
);
eq("listed 3 months not dim", v.dim, false);

v = T.evaluateRules(
  card({ listedRaw: "4个月前", listedMonths: 4, listedDays: 120 }),
  settings({ thresholds: { listedWithinValue: 3, listedWithinUnit: "month" } })
);
eq("listed 4 months dim", v.dim, true);

v = T.evaluateRules(card(), settings({}));
eq("both packs empty", v.dim, false);

v = T.evaluateRules(card(), settings({ thresholdsB: { dailySalesMin: 50 } }));
eq("only pack2 pass", v.dim, false);

v = T.evaluateRules(card(), settings({ thresholdsB: { dailySalesMin: 200 } }));
eq("only pack2 fail", v.dim, true);

v = T.evaluateRules(
  card({ category: "女士钥匙扣、钥匙链" }, { title: "Custom wallet", hasCustomBadge: true }),
  settings({ exclusions: { custom: true } })
);
eq("custom badge dims", v.dim, true);
if (!v.reasons.some((r) => String(r).indexOf("定制") >= 0)) {
  console.log("FAIL custom badge reason", v.reasons);
  fail += 1;
}

v = T.evaluateRules(
  card({ category: "女士钥匙扣、钥匙链" }, { title: "Custom wallet 定制钥匙扣", hasCustomBadge: false }),
  settings({ exclusions: { custom: true } })
);
eq("custom title without badge does not dim", v.dim, false);

v = T.evaluateRules(
  card({ category: "运动鞋" }, { title: "男士运动鞋", hasBrandLabel: true }),
  settings({ exclusions: { brandLabel: true } })
);
eq("brand label dims", v.dim, true);
if (!v.reasons.some((r) => String(r).indexOf("品牌") >= 0)) {
  console.log("FAIL brand label reason", v.reasons);
  fail += 1;
}

v = T.evaluateRules(
  card({ category: "运动鞋" }, { title: "男士运动鞋 品牌鞋", hasBrandLabel: false }),
  settings({ exclusions: { brandLabel: true } })
);
eq("title 品牌 without chip does not dim", v.dim, false);

eq("pcs 24pcs", T.parsePcsCount("24pcs flower"), 24);
eq("pcs 件", T.parsePcsCount("50件套装"), 50);
eq("pcs 个", T.parsePcsCount("30个装"), 30);
eq("pcs skip 个月", T.parsePcsCount("上架3个月"), null);

v = T.evaluateRules(card({}, { title: "24pcs set", pcs: 24 }), settings({ pcsOver: 20 }));
eq("pcs over dims", v.dim, true);

v = T.evaluateRules(card({}, { title: "10pcs set", pcs: 10 }), settings({ pcsOver: 20 }));
eq("pcs under does not dim", v.dim, false);

v = T.evaluateRules(card({}, { title: "24pcs set", pcs: 24 }), settings({}));
eq("pcs empty off", v.dim, false);

eq("sale min of two", T.parseSalePrice("$19.65 $28.32 已售"), 19.65);
eq("sale skip 今天支付", T.parseSalePrice("$2.92 $1.84 今天支付$0.46"), 1.84);

v = T.evaluateRules(card({}, { price: 1.5 }), settings({ priceAtMost: 2 }));
eq("price at most dims", v.dim, true);

v = T.evaluateRules(card({}, { price: 2.01 }), settings({ priceAtMost: 2 }));
eq("price above keeps", v.dim, false);

v = T.evaluateRules(card({}, { price: 2 }), settings({ priceAtMost: 2 }));
eq("price equal dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "美术用品和手工艺品" }, { title: "6支油性蜡水彩丽笔 专业吸合" }),
  settings({ exclusions: { pen: true } })
);
eq("pen art marker title dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "手机支架" }, { title: "A5笔记本文具" }),
  settings({ exclusions: { pen: true } })
);
eq("notebook not pen", v.dim, false);

v = T.evaluateRules(
  card({ category: "书写工具" }, { title: "Phone holder" }),
  settings({ exclusions: { pen: true } })
);
eq("pen category 书写 dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "个护清洁" }, { title: "浓缩洗衣液 1L" }),
  settings({ exclusions: { liquid: true } })
);
eq("liquid detergent dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "美容护理" }, { title: "vitamin serum 30ml" }),
  settings({ exclusions: { liquid: true } })
);
eq("liquid serum dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "手机配件" }, { title: "液晶屏幕保护膜" }),
  settings({ exclusions: { liquid: true } })
);
eq("lcd not liquid", v.dim, false);

v = T.evaluateRules(
  card({ category: "美术用品和手工艺品" }, { title: "6支油性蜡水彩丽笔 专业吸合" }),
  settings({ exclusions: { liquid: true } })
);
eq("oil pen not liquid", v.dim, false);

v = T.evaluateRules(
  card({ category: "刀具、零件和配件" }, { title: "升级款2件装猫爪造型伸缩美工刀组合" }),
  settings({ exclusions: { knife: true } })
);
eq("box cutter dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "手机支架" }, { title: "升级款2件装猫爪造型伸缩美工" }),
  settings({ exclusions: { knife: true } })
);
eq("cutter title without 刀 keeps if no keyword", v.dim, false);

v = T.evaluateRules(
  card({ category: "工具" }, { title: "十字螺丝刀套装" }),
  settings({ exclusions: { knife: true } })
);
eq("screwdriver not knife", v.dim, false);

v = T.evaluateRules(
  card({ category: "玩具手办玩偶套装" }, { title: "6件套随机宠物笼宠物玩偶 非儿童使用 圣诞节礼物" }),
  settings({ exclusions: { toysKids: true } })
);
eq("not-for-children toy keeps", v.dim, false);

v = T.evaluateRules(
  card({ category: "玩具手办玩偶套装" }, { title: "木制积木 儿童适用 3岁+" }),
  settings({ exclusions: { toysKids: true } })
);
eq("for children dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "家居" }, { title: "童趣贴纸墙贴" }),
  settings({ exclusions: { toysKids: true } })
);
eq("bare 童 still dims", v.dim, true);

v = T.evaluateRules(
  card({ category: "婴童用品" }, { title: "Phone holder" }),
  settings({ exclusions: { toysKids: true } })
);
eq("baby category dims", v.dim, true);

if (fail) {
  console.log("RULES_FAIL", fail);
  process.exit(1);
}
console.log("RULES_OK");
