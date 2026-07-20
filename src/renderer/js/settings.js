/**
 * Panel Setting: ngon ngu + so luong chay + danh sach muc check.
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

  function getCheckKeys() {
    return $$('#check-list input[type="checkbox"]:checked').map((el) => el.dataset.key);
  }

  function getThreads() {
    return Math.max(1, parseInt($('#num-threads').value, 10) || 1);
  }

  function getTestWaitSec() {
    return Math.max(1, Math.round((cfg.testWaitMs || 10000) / 1000));
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
    // Ve lai cac phan JS-generated
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
    applyLocale(locale);

    $('#sel-locale').addEventListener('change', async () => {
      const next = $('#sel-locale').value === 'en' ? 'en' : 'vi';
      cfg.locale = next;
      await window.api.config.set({ locale: next });
      // Dong bo locale ben main (log check se dung dung ngon ngu)
      applyLocale(next);
    });

    $('#num-threads').addEventListener('change', () => {
      const v = getThreads();
      $('#num-threads').value = v;
      window.api.config.set({ threads: v });
    });

    $('#chk-auto-close').addEventListener('change', () => {
      const on = $('#chk-auto-close').checked;
      cfg.autoClose = on;
      window.api.config.set({ autoClose: on });
    });

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

  return { init, getCheckKeys, getThreads, getTestWaitSec, getAutoClose, applyLocale };
})();
