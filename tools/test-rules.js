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

if (fail) {
  console.log("RULES_FAIL", fail);
  process.exit(1);
}
console.log("RULES_OK");
