/**
 * Noi nut "Automation" tren topbar voi lop phu React (src/automation).
 *
 * Ban than man Automation do bundle automation.js dung len va tu quan ly,
 * o day chi lo viec mo / dong va bao loi cho de hieu khi bundle chua duoc build.
 */
window.AutomationUI = (() => {
  const HOST_ID = 'automation-root';

  const host = () => document.getElementById(HOST_ID);
  const isOpen = () => !!host() && !host().hidden;

  /** Bundle chi ton tai sau khi chay `npm run build:automation`. */
  function available() {
    return !!(window.AutomationApp && typeof window.AutomationApp.open === 'function');
  }

  function open() {
    if (!available()) {
      logLine('Chua co ban build cua man Automation. Chay: npm run build:automation', 'err');
      return;
    }
    window.AutomationApp.open();
  }

  function close() {
    if (available()) window.AutomationApp.close();
    else if (host()) host().hidden = true;
  }

  function toggle() {
    isOpen() ? close() : open();
  }

  function init() {
    const btn = document.getElementById('btn-automation');
    if (!btn) return;

    btn.addEventListener('click', toggle);

    // Esc dong Automation, nhung nhuong Detail Log neu popup do dang mo.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen() && !DetailLog.isOpen()) close();
    });
  }

  return { init, open, close, toggle, isOpen, available };
})();
