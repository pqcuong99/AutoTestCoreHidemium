/**
 * Panel Setting (ben phai) + popover topbar (Theme / Language).
 * Moi thay doi deu duoc luu ngay vao config.json.
 */
window.Settings = (() => {
  let cfg = {};

  function groupLabel(group) {
    const key = 'checkGroup.' + group;
    const translated = t(key);
    return translated === key ? group : translated;
  }

  function renderChecks(checks) {
    const box = $('#check-list');
    let html = '';
    let lastGroup = null;

    CHECK_ITEMS.forEach((item) => {
      if (item.group !== lastGroup) {
        html += `<div class="check-group">${escapeHtml(groupLabel(item.group))}</div>`;
        lastGroup = item.group;
      }
      const on = checks[item.key] ? 'checked' : '';
      html += `<label class="check-item">
        <input type="checkbox" data-key="${item.key}" ${on} />
        <span>${escapeHtml(item.label)}</span>
      </label>`;
    });

    box.innerHTML = html;
  }

  function renderOsOptions() {
    const sel = $('#sel-target-os');
    if (!sel) return;
    const cur = cfg.targetOs || 'windows';
    // Phai khop supported trong platformPolicy/<os>.js (renderer khong require duoc policy).
    const opts = [
      { id: 'all', label: t('os.all'), supported: true },
      { id: 'windows', label: t('os.windows'), supported: true },
      { id: 'macos', label: t('os.macos'), supported: true },
      { id: 'linux', label: t('os.linux'), supported: true },
      { id: 'ios', label: t('os.ios'), supported: true },
      { id: 'android', label: t('os.android'), supported: true },
    ];
    sel.innerHTML = opts
      .map(
        (o) =>
          `<option value="${o.id}" ${o.id === cur ? 'selected' : ''} ${
            o.supported ? '' : 'disabled'
          }>${escapeHtml(o.label)}</option>`
      )
      .join('');
    if (!opts.some((o) => o.id === cur && o.supported)) {
      sel.value = 'windows';
      cfg.targetOs = 'windows';
    }
  }

  function renderLocaleOptions() {
    const sel = $('#sel-locale');
    if (!sel) return;
    const cur = cfg.locale === 'en' ? 'en' : 'vi';
    sel.innerHTML = `
      <option value="vi" ${cur === 'vi' ? 'selected' : ''}>${escapeHtml(t('lang.vi'))}</option>
      <option value="en" ${cur === 'en' ? 'selected' : ''}>${escapeHtml(t('lang.en'))}</option>
    `;
  }

  function renderThemeOptions() {
    const sel = $('#sel-theme');
    if (!sel) return;
    const cur = cfg.theme === 'light' ? 'light' : 'dark';
    sel.innerHTML = `
      <option value="dark" ${cur === 'dark' ? 'selected' : ''}>${escapeHtml(t('theme.dark'))}</option>
      <option value="light" ${cur === 'light' ? 'selected' : ''}>${escapeHtml(t('theme.light'))}</option>
    `;
  }

  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    cfg.theme = next;
    document.documentElement.setAttribute('data-theme', next);
    const sel = $('#sel-theme');
    if (sel && sel.value !== next) sel.value = next;
    // Doi logo iOS/Linux (black <-> white fill)
    if (typeof Table !== 'undefined') Table.render();
  }

  function setSettingsOpen(open) {
    const pop = $('#settings-popover');
    const btn = $('#btn-settings');
    if (!pop || !btn) return;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.classList.toggle('active', open);
  }

  function getCheckKeys() {
    return $$('#check-list input[type="checkbox"]:checked').map((el) => el.dataset.key);
  }

  function getThreads() {
    return Math.max(1, parseInt($('#num-threads').value, 10) || 1);
  }

  function getTestWaitSec() {
    return Math.max(1, Math.round((cfg.testWaitMs || 10000) / 1000));
  }

  function getTargetOs() {
    return $('#sel-target-os')?.value || cfg.targetOs || 'windows';
  }

  function persistChecks() {
    const checks = {};
    $$('#check-list input[type="checkbox"]').forEach((el) => (checks[el.dataset.key] = el.checked));
    window.api.config.set({ checks });
  }

  function applyLocale(locale) {
    I18n.setLocale(locale);
    I18n.applyDom();
    renderChecks(cfg.checks || {});
    renderOsOptions();
    renderLocaleOptions();
    renderThemeOptions();
    if (typeof Table !== 'undefined') Table.render();
    if (typeof DRender !== 'undefined' && DetailLog.isOpen()) DRender.all();
    const pt = $('#progress-text');
    if (pt && !State.running) pt.textContent = t('status.ready');
  }

  function init(config) {
    cfg = config || {};
    $('#num-threads').value = config.threads;
    const locale = config.locale === 'en' ? 'en' : 'vi';
    cfg.locale = locale;
    cfg.theme = config.theme === 'light' ? 'light' : 'dark';
    $('#chk-auto-close').checked = !!config.autoClose;
    cfg.targetOs = config.targetOs || 'windows';
    const disableRestore = config.disableRestoreSession !== false;
    const restoreEl = $('#chk-disable-restore-session');
    if (restoreEl) restoreEl.checked = disableRestore;
    cfg.disableRestoreSession = disableRestore;

    applyTheme(cfg.theme);
    applyLocale(locale);

    $('#btn-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = $('#settings-popover');
      setSettingsOpen(!!pop?.hidden);
    });

    document.addEventListener('click', (e) => {
      const menu = $('#settings-menu');
      if (!menu || menu.contains(e.target)) return;
      setSettingsOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    });

    $('#sel-locale')?.addEventListener('change', async () => {
      const next = $('#sel-locale').value === 'en' ? 'en' : 'vi';
      cfg.locale = next;
      await window.api.config.set({ locale: next });
      applyLocale(next);
    });

    $('#sel-theme')?.addEventListener('change', async () => {
      const next = $('#sel-theme').value === 'light' ? 'light' : 'dark';
      applyTheme(next);
      await window.api.config.set({ theme: next });
    });

    $('#num-threads').addEventListener('change', () => {
      const v = getThreads();
      $('#num-threads').value = v;
      window.api.config.set({ threads: v });
    });

    $('#sel-target-os').addEventListener('change', () => {
      const os = getTargetOs();
      cfg.targetOs = os;
      window.api.config.set({ targetOs: os });
      if (typeof Table !== 'undefined') {
        Table.pruneSelectionByTargetOs?.();
        Table.render();
        Table.updateCount?.();
      }
    });

    $('#chk-auto-close').addEventListener('change', () => {
      const on = $('#chk-auto-close').checked;
      cfg.autoClose = on;
      window.api.config.set({ autoClose: on });
    });

    const restoreBox = $('#chk-disable-restore-session');
    if (restoreBox) {
      restoreBox.addEventListener('change', () => {
        const on = restoreBox.checked;
        cfg.disableRestoreSession = on;
        window.api.config.set({ disableRestoreSession: on });
      });
    }

    $('#check-list').addEventListener('change', persistChecks);

    $('#chk-all-on').addEventListener('click', () => {
      $$('#check-list input').forEach((el) => (el.checked = true));
      persistChecks();
    });
    $('#chk-all-off').addEventListener('click', () => {
      $$('#check-list input').forEach((el) => (el.checked = false));
      persistChecks();
    });
  }

  function getAutoClose() {
    return !!$('#chk-auto-close')?.checked;
  }

  function getDisableRestoreSession() {
    const el = $('#chk-disable-restore-session');
    if (el) return !!el.checked;
    return cfg.disableRestoreSession !== false;
  }

  return {
    init,
    getCheckKeys,
    getThreads,
    getTestWaitSec,
    getAutoClose,
    getDisableRestoreSession,
    getTargetOs,
    applyLocale,
    applyTheme,
  };
})();
