var TZ = TZ || {};

TZ.cloneDefaults = function () {
  return JSON.parse(JSON.stringify(TZ.DEFAULT_SETTINGS));
};

TZ.mergeSettings = function (saved) {
  const base = TZ.cloneDefaults();
  if (!saved || typeof saved !== "object") return base;
  const out = Object.assign(base, saved);
  out.thresholds = Object.assign(base.thresholds, saved.thresholds || {});
  out.thresholdsB = Object.assign(base.thresholdsB, saved.thresholdsB || {});
  out.exclusions = Object.assign({}, saved.exclusions || {});
  if (out.pcsOver == null && out.exclusions.over20pcs) out.pcsOver = 20;
  out.aiExclusions = Object.assign({}, saved.aiExclusions || {});
  out.ai = Object.assign(base.ai, saved.ai || {});
  out.autoOpen = Object.assign(base.autoOpen, saved.autoOpen || {});
  out.autoOpen.exclusions = Object.assign(
    {},
    base.autoOpen.exclusions,
    (saved.autoOpen && saved.autoOpen.exclusions) || {}
  );
  if (out.autoOpen.pcsOver == null && out.autoOpen.exclusions.over20pcs) out.autoOpen.pcsOver = 20;
  const savedPresets = saved.numericPresets || {};
  out.numericPresets = {
    thresholds: Array.isArray(savedPresets.thresholds) ? savedPresets.thresholds : [],
    thresholdsB: Array.isArray(savedPresets.thresholdsB) ? savedPresets.thresholdsB : [],
    autoOpen: Array.isArray(savedPresets.autoOpen) ? savedPresets.autoOpen : []
  };
  return out;
};

TZ.runtimeAlive = function () {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (err) {
    return false;
  }
};

TZ.loadSettings = function () {
  return new Promise((resolve) => {
    if (!TZ.runtimeAlive()) {
      resolve(TZ.cloneDefaults());
      return;
    }
    try {
      chrome.storage.local.get(TZ.STORAGE_SETTINGS, function (data) {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(TZ.cloneDefaults());
          return;
        }
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
    const copy = JSON.parse(JSON.stringify(settings || {}));
    copy.savedAt = Date.now();
    if (!TZ.runtimeAlive()) {
      resolve(copy);
      return;
    }
    const payload = {};
    payload[TZ.STORAGE_SETTINGS] = copy;
    TZ._writingSettings = true;
    try {
      chrome.storage.local.set(payload, function () {
        TZ._writingSettings = false;
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(copy);
          return;
        }
        resolve(copy);
      });
    } catch (err) {
      TZ._writingSettings = false;
      resolve(copy);
    }
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
