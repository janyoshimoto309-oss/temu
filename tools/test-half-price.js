const fn = function (text) {
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
    if (n > 0 && n <= 2000) prices.push(n);
  }
  prices.sort((a, b) => a - b);
  const uniq = [];
  for (const n of prices) {
    if (!uniq.length || Math.abs(uniq[uniq.length - 1] - n) > 0.001) uniq.push(n);
  }
  return uniq[0];
};

const cases = [
  ["$4.40即将售罄今天支付$1.10送超时赔付$5.00抵用金", 4.4],
  ["$2.92 $1.84 36% OFF 今天支付$0.46", 1.84],
  ["$1.69 $1.43 (15% OFF) 即将售罄 今天支付$0.35", 1.43],
  ["$1.31 已售 1,101件", 1.31],
  ["$3.32 $6.26 已售 1,712件", 3.32]
];
let fail = 0;
for (const [s, e] of cases) {
  const g = fn(s);
  if (g !== e) {
    console.log("FAIL", s, "=>", g, "expected", e);
    fail += 1;
  }
}
console.log(fail === 0 ? "HALF_OK" : "HALF_FAIL " + fail);
process.exit(fail === 0 ? 0 : 1);
