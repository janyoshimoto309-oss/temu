const STORAGE_SETTINGS = "tzSettings";

function isOn(settings) {
  return !settings || settings.pluginEnabled !== false;
}

async function load() {
  const data = await chrome.storage.local.get(STORAGE_SETTINGS);
  const on = isOn(data[STORAGE_SETTINGS]);
  const box = document.getElementById("pluginOn");
  box.checked = on;
  box.addEventListener("change", () => setOn(box.checked));
}

async function setOn(on) {
  const data = await chrome.storage.local.get(STORAGE_SETTINGS);
  const cur = Object.assign({}, data[STORAGE_SETTINGS] || {}, { pluginEnabled: on });
  await chrome.storage.local.set({ [STORAGE_SETTINGS]: cur });
}

load();
