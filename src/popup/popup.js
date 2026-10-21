const STORAGE_SETTINGS = "tzSettings";

function isOn(settings) {
  return !settings || settings.pluginEnabled !== false;
}

function skinOf(settings) {
  return settings && settings.panelSkin === "ice" ? "ice" : "violet";
}

function applySkin(skin) {
  document.documentElement.setAttribute("data-skin", skin);
  const btn = document.getElementById("skinBtn");
  if (btn) btn.title = skin === "ice" ? "换壳：黑紫" : "换壳：白蓝";
}

async function load() {
  const data = await chrome.storage.local.get(STORAGE_SETTINGS);
  const settings = data[STORAGE_SETTINGS] || {};
  const box = document.getElementById("pluginOn");
  box.checked = isOn(settings);
  box.addEventListener("change", () => setOn(box.checked));
  applySkin(skinOf(settings));
  const skinBtn = document.getElementById("skinBtn");
  if (skinBtn) skinBtn.addEventListener("click", () => toggleSkin());
}

async function setOn(on) {
  const data = await chrome.storage.local.get(STORAGE_SETTINGS);
  const cur = Object.assign({}, data[STORAGE_SETTINGS] || {}, { pluginEnabled: on });
  await chrome.storage.local.set({ [STORAGE_SETTINGS]: cur });
}

async function toggleSkin() {
  const data = await chrome.storage.local.get(STORAGE_SETTINGS);
  const cur = Object.assign({}, data[STORAGE_SETTINGS] || {});
  cur.panelSkin = skinOf(cur) === "ice" ? "violet" : "ice";
  applySkin(cur.panelSkin);
  await chrome.storage.local.set({ [STORAGE_SETTINGS]: cur });
}

load();
