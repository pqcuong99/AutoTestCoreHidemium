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
  AutomationUI.init();
  RunnerUI.init();

  // Sang tab da luu ngay tu dau, khong doi API tra ve.
  ProfileSource.setTabs(State.source);

  // Khoi phuc tick cu; ten profile duoc bu lai khi trang chua no duoc tai.
  const saved = config.selectedUuids || [];
  saved.forEach((uuid) => State.selected.set(uuid, { uuid, name: '' }));

  await ProfileSource.load({ source: State.source, page: 1 });

  // Tick cu co the nam o trang khac -> noi ro, tranh nhin badge ma tuong dang loi.
  if (saved.length) {
    logLine(`Da khoi phuc ${saved.length} tick tu lan truoc (co the nam o trang khac).`, 'warn');
  }
})();
