const fs = require("fs");
const vm = require("vm");
const ctx = {
  TZ: {},
  document: {},
  NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  URL,
  location: { origin: "https://www.temu.com/", href: "https://www.temu.com/" }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../src/content/parser.js", "utf8"), ctx);
const T = ctx.TZ;
let fail = 0;
function eq(name, got, expected) {
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    console.log("FAIL", name, got, expected);
    fail += 1;
  }
}

eq("dash", T.parseCount("-"), null);
eq("emdash", T.parseCount("—"), null);
eq("3.5万", T.parseCount("3.5万"), 35000);

const a = T.parseListedAge("4个月前");
if (!(a.months === 4 && a.days === 120)) {
  console.log("FAIL 4m", a);
  fail += 1;
}
const b = T.parseListedAge("2年前");
if (b.months !== 24) {
  console.log("FAIL 2y", b);
  fail += 1;
}
const c = T.parseListedAge("-");
if (!c.missing) {
  console.log("FAIL listed dash", c);
  fail += 1;
}

const flat =
  "知了数据 商品 销量：日- 周1667 月6750 总销售额：$ 125300 上架时间：6个月前 评分/评论数：4.80 / 760 品类：车刷 店铺 店铺名：X";
const z = T.parseZhiliaoText(flat);
console.log("flat", z);
if (z.daily !== null) {
  console.log("FAIL daily should skip", z.daily);
  fail += 1;
}
if (z.weekly !== 1667 || z.monthly !== 6750) {
  console.log("FAIL sales", z);
  fail += 1;
}
if (z.listedMonths !== 6) {
  console.log("FAIL listed 6m", z);
  fail += 1;
}
if (!String(z.category).includes("车刷")) {
  console.log("FAIL cat", z.category);
  fail += 1;
}

const old =
  "知了数据\n商品\n销量：日1000 周1106 月4948\n上架时间：2年前\n评分/评论数：4.90 / 199\n品类：眼部护理\n店铺\n店铺名：BOH";
const z2 = T.parseZhiliaoText(old);
if (z2.listedMonths !== 24) {
  console.log("FAIL 2y block", z2);
  fail += 1;
}

const shot =
  "知了数据\n商品\n销量：日- 周2500 月9667\n总销售额：$ 8\n上架时间：2年前\n评分/评论数：4.50 / 12910\n品类：床头柜和桌子手机固定架\n店铺\n店铺名：Charlotte\n开店时间：3年前\n已售 8.4万件";
const z3 = T.parseZhiliaoText(shot);
if (z3.listedRaw !== "2年前" || z3.listedMonths !== 24) {
  console.log("FAIL screenshot listed", z3);
  fail += 1;
}
if (z3.daily !== null) {
  console.log("FAIL screenshot daily", z3.daily);
  fail += 1;
}
eq("extract 2y", T.extractListedRaw(shot), "2年前");
eq("extract split", T.extractListedRaw("上架时间：\n2年前\n评分/评论数：4.50"), "2年前");
const dashSales =
  "知了数据 商品 销量：日- 周- 月- 总销售额：$ 6999.99 上架时间：2年前 评分/评论数：4.70 / 4686 品类：毛球 店铺 店铺名：X 开店时间：3年前";
const zDash = T.parseZhiliaoText(dashSales);
if (zDash.listedRaw !== "2年前" || zDash.listedMonths !== 24 || zDash.daily !== null) {
  console.log("FAIL dash sales listed", zDash);
  fail += 1;
}

const leftShot =
  "知了数据\n商品\n销量：日93 周563 月1072\n总销售额：$ 4845\n上架时间：3个月前\n评分/评论数：5.00 / 6\n品类：力量训练设备\n店铺\n店铺名：dimaozhiyingdian\n评分/评论数：3.93 / 82";
const zLeft = T.parseZhiliaoText(leftShot);
if (zLeft.reviews !== 6 || zLeft.rating !== 5) {
  console.log("FAIL left shot reviews", zLeft);
  fail += 1;
}
const splitNums = T.parseZhiliaoText(
  "知了数据\n商品\n销量：日93 周563 月1072\n上架时间：3个月前\n评分/评论数：\n5.00\n6\n品类：力量训练设备\n店铺\n评分/评论数：3.93 / 82"
);
if (splitNums.reviews !== 6 || splitNums.rating !== 5) {
  console.log("FAIL split rating/reviews", splitNums);
  fail += 1;
}
const noSlash = T.parseZhiliaoText(
  "知了数据 商品 销量：日93 周563 月1072 上架时间：3个月前 评分/评论数： 5.00 6 品类：力量训练设备 店铺 店铺名：x 评分/评论数： 3.93 82"
);
if (noSlash.reviews !== 6 || noSlash.rating !== 5) {
  console.log("FAIL no-slash reviews", noSlash);
  fail += 1;
}

eq("price $3.90", T.parsePriceNumber("$3.90"), 3.9);
eq("price 3.32", T.parsePriceNumber("$3.32"), 3.32);
eq("half 3.90", T.formatHalfPrice(3.9), "1.95");
eq("half 3.32", T.formatHalfPrice(3.32), "1.66");
eq("half 1.31", T.formatHalfPrice(1.31), "0.66");
eq("half 3.94", T.formatHalfPrice(3.94), "1.97");
eq("half no dollar", T.formatHalfPrice("$7.07"), "3.54");

console.log(fail === 0 ? "PARSE_OK" : "PARSE_FAIL " + fail);
process.exit(fail === 0 ? 0 : 1);
