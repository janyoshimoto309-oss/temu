var TZ = TZ || {};

TZ.HOST_ID = "tz-filter-host";
TZ.CARD_ATTR = "data-tz-card";
TZ.STATE_ATTR = "data-tz-state";
TZ.REASON_ATTR = "data-tz-reason";
TZ.ID_ATTR = "data-tz-id";
TZ.AD_ATTR = "data-tz-ad";
TZ.DIM_CLASS = "tz-card-dim";
TZ.PAUSE_CLASS = "tz-pause-dim";
TZ.HALF_CLASS = "tz-half-price";
TZ.HALF_ATTR = "data-tz-half";

TZ.STORAGE_SETTINGS = "tzSettings";
TZ.STORAGE_API_KEY = "tzApiKey";
TZ.STORAGE_AI_CACHE = "tzAiCache";

TZ.MSG = {
  TOGGLE_PANEL: "TZ_TOGGLE_PANEL",
  OPEN_TAB: "TZ_OPEN_TAB",
  SET_API_KEY: "TZ_SET_API_KEY",
  GET_API_KEY_META: "TZ_GET_API_KEY_META",
  AI_CLASSIFY: "TZ_AI_CLASSIFY",
  SET_PLUGIN_ENABLED: "TZ_SET_PLUGIN_ENABLED",
  PING: "TZ_PING"
};

TZ.isPluginOn = function (settings) {
  const s = settings || (TZ.filter && TZ.filter.settings);
  return !s || s.pluginEnabled !== false;
};

TZ.RULE_EXCLUSIONS = [
  {
    id: "clothing",
    label: "服装 / 饰品",
    category: ["服装", "衣服", "服饰", "女装", "男装", "内衣", "睡衣", "袜子", "饰品", "首饰", "项链", "耳环", "戒指", "手链", "手镯"],
    title: ["服装", "衣服", "连衣裙", "内衣", "内裤", "文胸", "袜子", "饰品", "项链", "耳环", "T恤", "t-shirt", "dress", "apparel", "jewelry"]
  },
  {
    id: "bags",
    label: "包 / 皮包",
    category: ["皮包", "背包", "手提包", "挎包", "钱包", "箱包", "女包", "男包"],
    title: ["皮包", "手提包", "双肩包", "斜挎包", "背包", "handbag", "backpack", "tote bag", "crossbody"]
  },
  {
    id: "auto",
    label: "汽车用品",
    category: ["汽车", "车用", "车载", "车刷", "车饰", "车内", "汽配"],
    title: ["汽车", "车载", "车用", "车刷", "车窗", "车内", "车载支架", "car mount", "automotive"]
  },
  {
    id: "pen",
    label: "笔",
    category: ["笔", "书写", "文具笔"],
    title: ["圆珠笔", "钢笔", "铅笔", "中性笔", "马克笔", "水彩笔", "gel pen", "ballpoint"]
  },
  {
    id: "massage",
    label: "按摩",
    category: ["按摩", "筋膜"],
    title: ["按摩", "筋膜枪", "massage", "fascia"]
  },
  {
    id: "toysKids",
    label: "玩具 / 儿童",
    category: ["玩具", "儿童", "婴童", "童装", "母婴", "kids", "baby"],
    title: ["玩具", "儿童", "婴儿", "童", "kids", "baby", "toddler", "infant", "toy"]
  },
  {
    id: "print3d",
    label: "3D 打印",
    category: ["3D打印", "3D 打印", "3d打印"],
    title: ["3D打印", "3D 打印", "3d print", "3d printed", "3d printer"]
  },
  {
    id: "custom",
    label: "定制",
    category: ["定制", "订制", "个性化"],
    title: ["定制", "订制", "私人订制", "custom", "personalized", "personalised", "engraved"]
  },
  {
    id: "over20pcs",
    label: "超过 20pcs",
    special: "pcs"
  },
  {
    id: "knife",
    label: "刀",
    category: ["刀", "刀具", "刀具刀"],
    title: ["菜刀", "水果刀", "刀具", "折叠刀", "knife", "knives", "machete", "dagger", "blade"]
  },
  {
    id: "electric",
    label: "带电",
    category: ["带电", "锂电池"],
    title: ["带电", "锂电池", "锂电", "充电电池", "battery pack", "lithium", "插头"]
  }
];

TZ.AI_EXCLUSIONS = [
  { id: "knockoff", label: "品牌擦边高仿" },
  { id: "ip", label: "侵权 / 知名 IP" },
  { id: "adult", label: "18 挂钩" },
  { id: "foodContact", label: "食品接触" }
];

TZ.DEFAULT_SETTINGS = {
  pluginEnabled: true,
  searchPageEnabled: false,
  pauseDim: false,
  panelCollapsed: false,
  panelLeft: null,
  panelTop: null,
  thresholds: {
    dailySalesMin: null,
    weeklySalesMin: null,
    monthlySalesMin: null,
    listedWithinValue: null,
    listedWithinUnit: "month",
    ratingMin: null,
    reviewMin: null,
    temuSoldMin: null
  },
  thresholdsB: {
    dailySalesMin: null,
    weeklySalesMin: null,
    monthlySalesMin: null,
    listedWithinValue: null,
    listedWithinUnit: "month",
    ratingMin: null,
    reviewMin: null,
    temuSoldMin: null
  },
  exclusions: {},
  aiExclusions: {},
  ai: {
    enabled: false,
    model: "gemini-2.0-flash"
  },
  autoOpen: {
    enabled: false,
    maxCount: 10,
    intervalSec: 2.5,
    dailySalesMin: null,
    monthlySalesMin: null,
    temuSoldMin: null,
    listedWithinValue: null,
    listedWithinUnit: "month"
  },
  savedAt: null
};

TZ.AI_PROMPT_LABELS = {
  knockoff: "brand knockoff / counterfeit / replica / 高仿 / 擦边仿牌",
  ip: "famous IP infringement (Disney, Marvel, Sanrio, sports teams, luxury logos)",
  adult: "adult / sexual / 18+ themed products",
  foodContact: "food-contact items (cups, bowls, cutlery, straws, lunch boxes, baby bottles) that may fail food-safety rules"
};
