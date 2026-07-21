/**
 * Panel Setting: ngon ngu + OS target + so luong chay + danh sach muc check.
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
    const opts = [
      { id: 'windows', label: t('os.windows'), supported: true },
      { id: 'macos', label: t('os.macos'), supported: false },
      { id: 'ios', label: t('os.ios'), supported: false },
      { id: 'android', label: t('os.android'), supported: false },
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
    if (typeof Table !== 'undefined') Table.render();
    if (typeof DRender !== 'undefined' && DetailLog.isOpen()) DRender.all();
    const pt = $('#progress-text');
    if (pt && !State.running) pt.textContent = t('status.ready');
  }

  function init(config) {
    cfg = config || {};
    $('#num-threads').value = config.threads;
    const locale = config.locale === 'en' ? 'en' : 'vi';
    $('#sel-locale').value = locale;
    $('#chk-auto-close').checked = !!config.autoClose;
    cfg.targetOs = config.targetOs || 'windows';
    const disableRestore = config.disableRestoreSession !== false;
    const restoreEl = $('#chk-disable-restore-session');
    if (restoreEl) restoreEl.checked = disableRestore;
    cfg.disableRestoreSession = disableRestore;
    applyLocale(locale);

    $('#sel-locale').addEventListener('change', async () => {
      const next = $('#sel-locale').value === 'en' ? 'en' : 'vi';
      cfg.locale = next;
      await window.api.config.set({ locale: next });
      applyLocale(next);
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
  };
})();
