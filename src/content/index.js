var TZ = TZ || {};

(async function boot() {
  if (window.__TZ_LOADED) return;
  window.__TZ_LOADED = true;

  const settings = await TZ.loadSettings();
  TZ.filter.settings = settings;
  await TZ.panel.mount(settings);
  TZ.pageScope.refresh();
  TZ.filter.run(settings);
  if (TZ.detailRecs) TZ.detailRecs.run(settings);
  if (TZ.priceBadge) TZ.priceBadge.run();
  TZ.observer.start();

  TZ.onSettingsChange((next) => {
    TZ.filter.settings = next;
    TZ.panel.sync(next);
    TZ.filter.run(next);
    if (TZ.detailRecs) TZ.detailRecs.run(next);
    if (TZ.priceBadge) TZ.priceBadge.run();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === TZ.MSG.TOGGLE_PANEL) {
      TZ.panel.toggle();
      sendResponse({ ok: true });
    }
  });
})();
