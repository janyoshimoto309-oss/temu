var TZ = TZ || {};

TZ.cloneDefaults = function () {
  return JSON.parse(JSON.stringify(TZ.DEFAULT_SETTINGS));
};

TZ.mergeSettings = function (saved) {
  const base = TZ.cloneDefaults();
  if (!saved || typeof saved !== "object") return base;
  const out = Object.assign(base, saved);
  out.thresholds = Object.assign(base.thresholds, saved.thresholds || {});
  out.exclusions = Object.assign({}, saved.exclusions || {});
  out.aiExclusions = Object.assign({}, saved.aiExclusions || {});
  out.ai = Object.assign(base.ai, saved.ai || {});
  out.autoOpen = Object.assign(base.autoOpen, saved.autoOpen || {});
  return out;
};

TZ.loadSettings = function () {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(TZ.STORAGE_SETTINGS, (data) => {
        resolve(TZ.mergeSettings(data && data[TZ.STORAGE_SETTINGS]));
      });
    } catch (err) {
      resolve(TZ.cloneDefaults());
    }
  });
};

TZ._writingSettings = false;

TZ.saveSettings = function (settings) {
  return new Promise((resolve) => {
    const payload = {};
    const copy = JSON.parse(JSON.stringify(settings || {}));
    copy.savedAt = Date.now();
    payload[TZ.STORAGE_SETTINGS] = copy;
    TZ._writingSettings = true;
    chrome.storage.local.set(payload, () => {
      TZ._writingSettings = false;
      resolve(copy);
    });
  });
};

TZ.onSettingsChange = function (handler) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[TZ.STORAGE_SETTINGS]) return;
    if (TZ._writingSettings) return;
    handler(TZ.mergeSettings(changes[TZ.STORAGE_SETTINGS].newValue));
  });
};

TZ.emptyNum = function (value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
