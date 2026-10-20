/* global chrome */

const STORAGE_SETTINGS = "tzSettings";
const STORAGE_API_KEY = "tzApiKey";
const STORAGE_AI_CACHE = "tzAiCache";

const MSG = {
  TOGGLE_PANEL: "TZ_TOGGLE_PANEL",
  OPEN_TAB: "TZ_OPEN_TAB",
  SET_API_KEY: "TZ_SET_API_KEY",
  GET_API_KEY_META: "TZ_GET_API_KEY_META",
  AI_CLASSIFY: "TZ_AI_CLASSIFY",
  SET_PLUGIN_ENABLED: "TZ_SET_PLUGIN_ENABLED"
};

const LABEL_TEXT = {
  knockoff: "brand knockoff / counterfeit / replica / 高仿擦边仿牌",
  ip: "famous IP infringement (Disney, Marvel, Sanrio, Nintendo, sports, luxury logos)",
  adult: "adult / sexual / 18+ themed products",
  foodContact: "food-contact items (cups, bowls, cutlery, straws, lunch boxes) that may be food-safety sensitive"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ["*://*.temu.com/*"] }, (tabs) => {
    (tabs || []).forEach((tab) => {
      if (!tab.id) return;
      chrome.tabs.reload(tab.id, { bypassCache: true }, () => {
        void chrome.runtime.lastError;
      });
    });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === MSG.OPEN_TAB) {
    openTab(msg.url, sender).then((ok) => sendResponse({ ok: ok }));
    return true;
  }
  if (msg.type === MSG.SET_API_KEY) {
    const key = String(msg.key || "").trim();
    chrome.storage.local.set({ [STORAGE_API_KEY]: key }, () => {
      sendResponse({ ok: true, tail: tailOf(key) });
    });
    return true;
  }
  if (msg.type === MSG.GET_API_KEY_META) {
    chrome.storage.local.get(STORAGE_API_KEY, (data) => {
      const key = data[STORAGE_API_KEY] || "";
      sendResponse({ ok: true, set: !!key, tail: tailOf(key) });
    });
    return true;
  }
  if (msg.type === MSG.AI_CLASSIFY) {
    classify(msg)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (msg.type === MSG.SET_PLUGIN_ENABLED) {
    chrome.storage.local.get(STORAGE_SETTINGS, (data) => {
      const cur = data[STORAGE_SETTINGS] || {};
      cur.pluginEnabled = msg.enabled !== false;
      chrome.storage.local.set({ [STORAGE_SETTINGS]: cur }, () => sendResponse({ ok: true }));
    });
    return true;
  }
});

function tailOf(key) {
  if (!key) return "";
  return key.length <= 4 ? "****" : "…" + key.slice(-4);
}

async function openTab(url, sender) {
  if (!url) return false;
  try {
    await chrome.tabs.create({
      url: url,
      active: false,
      openerTabId: sender && sender.tab ? sender.tab.id : undefined
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function classify(msg) {
  const keyData = await chrome.storage.local.get(STORAGE_API_KEY);
  const apiKey = (keyData[STORAGE_API_KEY] || "").trim();
  if (!apiKey) return { ok: false, error: "未配置 Gemini API Key" };

  const items = (msg.items || []).slice(0, 8);
  const labels = msg.labels || [];
  if (!items.length || !labels.length) return { ok: true, results: [] };

  const cacheBag = await chrome.storage.local.get(STORAGE_AI_CACHE);
  const cache = cacheBag[STORAGE_AI_CACHE] || {};
  const results = [];
  const needCall = [];

  items.forEach((item) => {
    const ck = cacheKey(item, labels);
    const hit = cache[ck];
    if (hit && Date.now() - hit.ts < 7 * 24 * 3600 * 1000) {
      results.push(Object.assign({ id: item.id }, hit.value));
    } else {
      needCall.push(item);
    }
  });

  for (const item of needCall) {
    const value = await classifyOne(apiKey, item, labels, msg.model);
    results.push(Object.assign({ id: item.id }, value));
    cache[cacheKey(item, labels)] = { ts: Date.now(), value: value };
  }

  const keys = Object.keys(cache);
  if (keys.length > 400) {
    keys
      .sort((a, b) => cache[a].ts - cache[b].ts)
      .slice(0, keys.length - 400)
      .forEach((k) => delete cache[k]);
  }
  await chrome.storage.local.set({ [STORAGE_AI_CACHE]: cache });
  return { ok: true, results: results };
}

function cacheKey(item, labels) {
  return (item.id || item.title || "") + "|" + labels.slice().sort().join(",") + "|" + (item.needImage ? "img" : "t");
}

async function classifyOne(apiKey, item, labels, model) {
  const labelLines = labels.map((id) => "- " + id + ": " + (LABEL_TEXT[id] || id)).join("\n");
  const prompt =
    "You filter Temu listings for a seller. Return JSON only:\n" +
    '{"hit":boolean,"labels":string[],"reason":string,"needsImage":boolean,"confidence":number}\n' +
    "hit=true only if the product clearly matches one of these enabled exclusion labels:\n" +
    labelLines +
    "\nIf unsure, hit=false and needsImage=true when a photo would help.\n" +
    "Title: " +
    (item.title || "") +
    "\nCategory hint: " +
    (item.category || "") +
    "\n";

  const parts = [{ text: prompt }];
  if (item.needImage && item.imageUrl) {
    const img = await fetchImagePart(item.imageUrl);
    if (img) parts.push(img);
  }

  const modelId = model || "gemini-2.0-flash";
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(modelId) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error("Gemini HTTP " + resp.status + " " + t.slice(0, 180));
  }
  const data = await resp.json();
  const text =
    (((data.candidates || [])[0] || {}).content || {}).parts &&
    data.candidates[0].content.parts.map((p) => p.text || "").join("");
  let parsed;
  try {
    parsed = JSON.parse(text || "{}");
  } catch (e) {
    parsed = { hit: false, reason: "parse-fail", labels: [] };
  }

  if (parsed.needsImage && item.imageUrl && !item.needImage) {
    return classifyOne(apiKey, Object.assign({}, item, { needImage: true }), labels, model);
  }

  const allowed = new Set(labels);
  const hitLabels = (parsed.labels || []).filter((x) => allowed.has(x));
  const confidence = Number(parsed.confidence);
  const hit = !!parsed.hit && hitLabels.length > 0 && (Number.isFinite(confidence) ? confidence >= 0.6 : true);
  return {
    hit: hit,
    labels: hitLabels,
    reason: String(parsed.reason || "").slice(0, 120),
    needsImage: !!parsed.needsImage,
    confidence: Number.isFinite(confidence) ? confidence : null
  };
}

async function fetchImagePart(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!mime.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 2.5 * 1024 * 1024) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return { inlineData: { mimeType: mime, data: btoa(binary) } };
  } catch (e) {
    return null;
  }
}

void STORAGE_SETTINGS;
