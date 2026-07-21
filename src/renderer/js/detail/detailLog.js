/**
 * POPUP DETAIL LOG - chay ngay trong cua so chinh (overlay), khong phai cua so rieng.
 *
 * Lam vay de:
 *  - Dung dang popup nhu yeu cau.
 *  - Khong mat su kien: truoc day popup la BrowserWindow rieng, su kien 'start' ban di
 *    khi renderer cua no chua load xong -> bang trong tron.
 *
 * DetailLog.handleEvent() duoc RunnerUI goi cho MOI su kien, ke ca khi popup dang dong,
 * nen mo popup giua chung van thay day du du lieu.
 */
window.DetailLog = (() => {
  const S = () => DStore.state;
  let isOpen = false;

  function pushLog(rec, message, kind) {
    rec.logs.push({
      time: new Date().toLocaleTimeString(I18n.timeLocale(), { hour12: false }),
      message,
      kind,
    });
    if (rec.logs.length > 500) rec.logs.shift();
  }

  /** Chi ve lai khi popup dang mo -> chay nen khong ton CPU. */
  const draw = {
    all: () => isOpen && DRender.all(),
    lanes: () => isOpen && DRender.lanes(),
    profiles: () => isOpen && DRender.profiles(),
    table: () => isOpen && DRender.table(),
    logs: () => isOpen && DRender.logs(),
  };

  function handleEvent(evt) {
    if (!DStore.accepts(evt)) return; // rac cua lan chay truoc -> bo

    switch (evt.type) {
      case 'start': {
        DStore.reset(evt.runId, evt.profiles, evt.checkKeys);
        S().lanes = evt.lanes || [];
        S().running = true;
        S().mode = evt.mode;
        draw.all();
        break;
      }

      case 'profile-start': {
        const r = DStore.record(evt.uuid, evt.name);
        r.laneId = evt.laneId;      // gan lane -> hien thi va doi chieu ve sau
        r.status = 'running';
        r.statusText = '';
        r.error = '';
        pushLog(r, t('detail.started', { laneId: evt.laneId }));
        if (S().follow) DStore.setCurrent(evt.uuid);
        draw.all();
        break;
      }

      case 'profile-opened': {
        const r = DStore.record(evt.uuid);
        r.open = evt.data;
        if (evt.data?.profile_name) r.name = evt.data.profile_name;
        draw.profiles();
        if (S().current === evt.uuid) draw.table();
        break;
      }

      case 'detail-rows': {
        const r = DStore.record(evt.uuid);
        r.rows = evt.rows;                          // ghi dung record cua uuid nay
        if (evt.profileName) r.name = evt.profileName;
        if (evt.checkKeys) S().checkKeys = evt.checkKeys;
        if (S().current === evt.uuid) draw.table();
        break;
      }

      case 'site-result': {
        const r = DStore.record(evt.uuid);
        const row = r.rows?.[evt.checkKey];
        if (row) {
          if (!row.sites) row.sites = {};
          row.sites[evt.siteKey] = {
            state: evt.state || (evt.pass ? 'pass' : 'fail'),
            value: evt.value != null ? evt.value : '',
            fields: Array.isArray(evt.fields) ? evt.fields : row.sites[evt.siteKey]?.fields || [],
          };
        }
        if (S().current === evt.uuid) draw.table();
        break;
      }

      case 'site-done': {
        const r = DStore.record(evt.uuid);
        // Chi ghi de khi skipped/fail toan cot; 'done' giu pass/fail tung o (tu site-result)
        if (evt.state === 'skipped' || evt.state === 'fail') {
          Object.values(r.rows).forEach((row) => {
            if (row.sites && row.sites[evt.siteKey]) {
              if (evt.state === 'skipped') {
                row.sites[evt.siteKey].state = 'skipped';
                if (!row.sites[evt.siteKey].value) row.sites[evt.siteKey].value = '-';
              } else if (row.sites[evt.siteKey].state === 'pending') {
                row.sites[evt.siteKey].state = 'fail';
              }
            }
          });
        }
        if (S().current === evt.uuid) draw.table();
        break;
      }

      case 'profile-error': {
        const r = DStore.record(evt.uuid);
        r.error = `[${evt.stage}] ${evt.error}`;
        pushLog(r, r.error, 'err');
        if (S().current === evt.uuid) { draw.table(); draw.logs(); }
        break;
      }

      case 'log': {
        const r = DStore.record(evt.uuid);
        pushLog(r, evt.message, evt.kind);
        if (S().current === evt.uuid) draw.logs();
        break;
      }

      case 'profile-done': {
        const r = DStore.record(evt.uuid);
        r.status = evt.status;
        r.statusText = evt.statusText || '';
        pushLog(r, t('detail.ended', { status: evt.statusText || evt.status }), evt.status === 'pass' ? 'ok' : 'warn');
        draw.profiles();
        if (S().current === evt.uuid) draw.logs();
        break;
      }

      case 'progress': {
        if (evt.lanes) S().lanes = evt.lanes;
        S().progress = `${evt.done}/${evt.total}`;
        if (isOpen) document.getElementById('dl-progress').textContent = S().progress;
        draw.lanes();
        break;
      }

      case 'lane-idle': {
        const lane = S().lanes.find((l) => l.laneId === evt.laneId);
        if (lane) { lane.busy = false; lane.uuid = null; lane.name = null; }
        draw.lanes();
        break;
      }

      case 'finish': {
        S().running = false;
        S().lanes = S().lanes.map((l) => ({ ...l, busy: false, uuid: null, name: null }));
        const s = evt.summary;
        S().progress = evt.error
          ? t('detail.progressError', { error: evt.error })
          : t('detail.progressDone', {
              pass: s?.pass || 0,
              fail: s?.fail || 0,
              error: s?.error || 0,
            }) + (evt.stopped ? t('detail.progressStopped') : '');
        draw.all();
        break;
      }
    }
  }

  // ---------- Dong / mo popup ----------
  function open() {
    isOpen = true;
    document.getElementById('dl-overlay').hidden = false;
    DRender.head();   // ve lai header cot moi lan mo
    DRender.all();    // do toan bo du lieu da tich luy khi popup dang dong
  }

  function close() {
    isOpen = false;
    document.getElementById('dl-overlay').hidden = true;
  }

  function toggle() {
    isOpen ? close() : open();
  }

  // ---------- Tuong tac ----------
  function pickProfile(e) {
    const item = e.target.closest('[data-uuid]');
    if (!item || !item.dataset.uuid) return;
    DStore.setCurrent(item.dataset.uuid);
    S().follow = false;
    document.getElementById('dl-follow').checked = false;
    DRender.all();
  }

  function init() {
    document.getElementById('dl-profiles').addEventListener('click', pickProfile);
    document.getElementById('dl-lanes').addEventListener('click', pickProfile);
    document.getElementById('dl-close').addEventListener('click', close);

    document.getElementById('dl-follow').addEventListener('change', (e) => {
      S().follow = e.target.checked;
    });

    // Bam nen mo phia ngoai -> dong popup
    document.getElementById('dl-overlay').addEventListener('mousedown', (e) => {
      if (e.target.id === 'dl-overlay') close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });

    // Bam "+ N truong nua..." -> xo het field (cot Config hoac cot site)
    document.getElementById('dl-tbody').addEventListener('click', (e) => {
      if (!e.target.classList.contains('kv-more')) return;
      const tr = e.target.closest('tr');
      const td = e.target.closest('td');
      const row = DStore.current()?.rows?.[tr?.dataset.key];
      if (!row || !td) return;
      if (td.classList.contains('cell-b')) {
        td.innerHTML = DRender.fieldsHtmlAll(row.config);
        return;
      }
      if (td.classList.contains('cell-site') && td.dataset.site) {
        const site = row.sites?.[td.dataset.site];
        if (site?.fields?.length) {
          const cls = { pass: 'site-pass', fail: 'site-fail' }[site.state] || '';
          td.innerHTML = `<div class="site-cell site-kv ${cls}">${DRender.fieldsHtmlAll(site.fields)}</div>`;
        }
      }
    });

    // Bam header cot website -> mo web that
    document.getElementById('dl-thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-url]');
      if (th) window.api.shell.openExternal(th.dataset.url);
    });

    DRender.head();
  }

  return { init, open, close, toggle, handleEvent, isOpen: () => isOpen };
})();
