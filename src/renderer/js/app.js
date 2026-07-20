/**
 * Diem khoi dong renderer: nap config -> dung UI -> goi API lay profile.
 */
(async function bootstrap() {
  const config = await window.api.config.get();
  State.config = config;
  State.source = config.sourceMode === 'local' ? 'local' : 'cloud';

  Settings.init(config);
  Table.init();
  ProfileSource.init();
  DetailLog.init();
  RunnerUI.init();

  ProfileSource.setTabs(State.source);

  const saved = config.selectedUuids || [];
  saved.forEach((uuid) => State.selected.set(uuid, { uuid, name: '' }));

  // pruneSelection: bo tick profile da xoa ben Hidemium truoc khi thong bao khoi phuc
  await ProfileSource.load({ source: State.source, page: 1, pruneSelection: true });

  const kept = State.selected.size;
  if (saved.length && kept) {
    logLine(t('log.restoredTicks', { n: kept }), 'warn');
  }
})();
