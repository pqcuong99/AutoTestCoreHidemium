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
  const GEOM_KEY = 'autotest.dlWindowGeom';
  const MIN_W = 480;
  const MIN_H = 280;

  let isOpen = false;
  let maximized = false;
  /** @type {{ left:number, top:number, width:number, height:number } | null} */
  let restoreGeom = null;
  /** @type {(() => void) | null} */
  let clampLogHeight = null;

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
        if (S().follow) {
          DStore.setCurrent(evt.uuid);
          DRender.clearExpandedCells?.();
        }
        draw.all();
        break;
      }

      case 'profile-opened': {
        const r = DStore.record(evt.uuid);
        r.open = evt.data;
        if (evt.data?.profile_name) r.name = evt.data.profile_name;
        const openedOs =
          evt.data?.os || evt.data?.OS || evt.data?.platform || '';
        if (openedOs) r.os = openedOs;
        if (window.ProfileOs) {
          const bName = window.ProfileOs.pickBrowserFromBrowser(evt.data);
          const bVer = window.ProfileOs.pickBrowserVersion(evt.data);
          const label = window.ProfileOs.formatBrowserLabel(bName, bVer);
          if (label) r.browser = label;
        }
        draw.profiles();
        if (S().current === evt.uuid) draw.table();
        break;
      }

      case 'profile-meta': {
        const r = DStore.record(evt.uuid);
        if (evt.os) r.os = evt.os;
        if (evt.browser) r.browser = evt.browser;
        if (evt.name) r.name = evt.name;
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
        // Cap nhat tung o: value + pass/fail + lines (SiteHighlight) / fields (sannysoft/iphey)
        const r = DStore.record(evt.uuid);
        if (!r.rows[evt.checkKey]) {
          r.rows[evt.checkKey] = { config: null, sites: {} };
        }
        if (!r.rows[evt.checkKey].sites) r.rows[evt.checkKey].sites = {};
        const prev = r.rows[evt.checkKey].sites[evt.siteKey] || {};
        r.rows[evt.checkKey].sites[evt.siteKey] = {
          state: evt.state || (evt.pass ? 'pass' : 'fail'),
          value: evt.value ?? '',
          pass: evt.pass != null ? !!evt.pass : prev.pass,
          lines: Array.isArray(evt.lines) ? evt.lines : prev.lines || null,
          fields: Array.isArray(evt.fields) ? evt.fields : prev.fields || [],
        };
        if (S().current === evt.uuid) draw.table();
        break;
      }

      case 'site-done': {
        // Khong ghi de pass/fail bang 'done'. Chi xu ly skipped / fail toan cot.
        if (evt.state === 'skipped' || evt.state === 'fail') {
          const r = DStore.record(evt.uuid);
          Object.values(r.rows).forEach((row) => {
            if (!row.sites || !row.sites[evt.siteKey]) return;
            if (evt.state === 'skipped') {
              row.sites[evt.siteKey] = { state: 'skipped', value: '-', fields: [], lines: null };
            } else if (row.sites[evt.siteKey].state === 'pending') {
              row.sites[evt.siteKey].state = 'fail';
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
  function overlayEl() {
    return document.getElementById('dl-overlay');
  }
  function modalEl() {
    return document.getElementById('dl-modal');
  }

  function bounds() {
    const ov = overlayEl();
    return { w: ov.clientWidth, h: ov.clientHeight };
  }

  function clampGeom(g) {
    const b = bounds();
    const width = Math.max(MIN_W, Math.min(g.width, b.w));
    const height = Math.max(MIN_H, Math.min(g.height, b.h));
    const left = Math.max(0, Math.min(g.left, Math.max(0, b.w - width)));
    const top = Math.max(0, Math.min(g.top, Math.max(0, b.h - height)));
    return { left, top, width, height };
  }

  function readGeom() {
    const m = modalEl();
    return {
      left: m.offsetLeft,
      top: m.offsetTop,
      width: m.offsetWidth,
      height: m.offsetHeight,
    };
  }

  function applyGeom(g) {
    const m = modalEl();
    const c = clampGeom(g);
    m.style.left = c.left + 'px';
    m.style.top = c.top + 'px';
    m.style.width = c.width + 'px';
    m.style.height = c.height + 'px';
    return c;
  }

  function defaultGeom() {
    const b = bounds();
    const width = Math.max(MIN_W, Math.round(b.w * 0.92));
    const height = Math.max(MIN_H, Math.round(b.h * 0.9));
    return {
      left: Math.round((b.w - width) / 2),
      top: Math.round((b.h - height) / 2),
      width,
      height,
    };
  }

  function loadSavedGeom() {
    try {
      const raw = localStorage.getItem(GEOM_KEY);
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || typeof g.left !== 'number') return null;
      return g;
    } catch {
      return null;
    }
  }

  function saveGeom() {
    if (maximized) return;
    try {
      localStorage.setItem(GEOM_KEY, JSON.stringify(readGeom()));
    } catch {
      /* ignore */
    }
  }

  function setMaximized(on) {
    const m = modalEl();
    const btn = document.getElementById('dl-maximize');
    maximized = !!on;
    m.classList.toggle('dl-maximized', maximized);
    if (btn) {
      btn.innerHTML = maximized ? '&#9634;' : '&#9633;';
      btn.title = t(maximized ? 'detail.restoreSize' : 'detail.maximize');
      btn.setAttribute('data-i18n-title', maximized ? 'detail.restoreSize' : 'detail.maximize');
    }
  }

  function toggleMaximize() {
    if (maximized) {
      setMaximized(false);
      applyGeom(restoreGeom || loadSavedGeom() || defaultGeom());
    } else {
      restoreGeom = readGeom();
      setMaximized(true);
    }
    saveGeom();
    clampLogHeight?.();
  }

  function initWindowChrome() {
    const header = document.getElementById('dl-drag');
    const modal = modalEl();

    // --- Drag ---
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, label, a, .mini')) return;
      if (maximized) return;

      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const start = readGeom();
      header.classList.add('dl-dragging');
      document.body.classList.add('dl-win-moving');

      const onMove = (ev) => {
        applyGeom({
          ...start,
          left: start.left + (ev.clientX - startX),
          top: start.top + (ev.clientY - startY),
        });
      };
      const onUp = () => {
        header.classList.remove('dl-dragging');
        document.body.classList.remove('dl-win-moving');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveGeom();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    header.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, input, label, a')) return;
      toggleMaximize();
    });

    // --- Resize ---
    modal.querySelectorAll('.dl-resize').forEach((handle) => {
      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || maximized) return;
        e.preventDefault();
        e.stopPropagation();
        const edge = handle.dataset.edge || '';
        const startX = e.clientX;
        const startY = e.clientY;
        const start = readGeom();
        document.body.classList.add('dl-win-resizing');

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let { left, top, width, height } = start;

          if (edge.includes('e')) width = start.width + dx;
          if (edge.includes('s')) height = start.height + dy;
          if (edge.includes('w')) {
            width = start.width - dx;
            left = start.left + dx;
          }
          if (edge.includes('n')) {
            height = start.height - dy;
            top = start.top + dy;
          }

          if (width < MIN_W) {
            if (edge.includes('w')) left = start.left + start.width - MIN_W;
            width = MIN_W;
          }
          if (height < MIN_H) {
            if (edge.includes('n')) top = start.top + start.height - MIN_H;
            height = MIN_H;
          }

          applyGeom({ left, top, width, height });
        };
        const onUp = () => {
          document.body.classList.remove('dl-win-resizing');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          saveGeom();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });

    document.getElementById('dl-maximize').addEventListener('click', toggleMaximize);

    window.addEventListener('resize', () => {
      if (!isOpen || maximized) return;
      applyGeom(readGeom());
    });
  }

  function open() {
    isOpen = true;
    const ov = overlayEl();
    ov.hidden = false;
    const saved = loadSavedGeom();
    setMaximized(false);
    applyGeom(saved || defaultGeom());
    DRender.head();
    DRender.all();
    clampLogHeight?.();
  }

  function close() {
    isOpen = false;
    if (!maximized) saveGeom();
    overlayEl().hidden = true;
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
    DRender.clearExpandedCells?.();
    DRender.all();
  }

  function initLogResize() {
    const LOG_H_KEY = 'autotest.dlLogHeight';
    const MIN_H = 72;
    const split = document.getElementById('dl-log-split');
    const panel = document.getElementById('dl-log-panel');
    if (!split || !panel) return;

    function maxH() {
      const main = panel.parentElement;
      const mainH = main ? main.clientHeight : 600;
      return Math.max(MIN_H + 40, Math.floor(mainH * 0.7));
    }

    function applyH(h) {
      const clamped = Math.max(MIN_H, Math.min(maxH(), Math.round(h)));
      panel.style.height = clamped + 'px';
      return clamped;
    }

    clampLogHeight = () => {
      const h = panel.getBoundingClientRect().height || 160;
      applyH(h);
    };

    try {
      const saved = Number(localStorage.getItem(LOG_H_KEY));
      if (saved > 0) applyH(saved);
    } catch { /* ignore */ }

    let drag = null;

    split.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      drag = {
        startY: e.clientY,
        startH: panel.getBoundingClientRect().height,
      };
      split.classList.add('active');
      document.body.classList.add('dl-resizing-log');
    });

    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      // Splitter nam tren panel: keo LEN = log cao hon, keo XUONG = thap hon
      applyH(drag.startH - (e.clientY - drag.startY));
    });

    window.addEventListener('mouseup', () => {
      if (!drag) return;
      drag = null;
      split.classList.remove('active');
      document.body.classList.remove('dl-resizing-log');
      try {
        localStorage.setItem(LOG_H_KEY, String(Math.round(panel.getBoundingClientRect().height)));
      } catch { /* ignore */ }
    });

    // Khi resize cua so Detail Log / maximize — giu trong gioi han
    window.addEventListener('resize', () => {
      const h = panel.getBoundingClientRect().height;
      if (h > 0) applyH(h);
    });
  }

  function init() {
    document.getElementById('dl-profiles').addEventListener('click', pickProfile);
    document.getElementById('dl-lanes').addEventListener('click', pickProfile);
    document.getElementById('dl-close').addEventListener('click', close);

    document.getElementById('dl-follow').addEventListener('change', (e) => {
      S().follow = e.target.checked;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });

    // Bam "+ N more lines" / "Show less" trong o Config / site
    document.getElementById('dl-tbody').addEventListener('click', (e) => {
      const more = e.target.closest('.kv-more');
      const less = e.target.closest('.kv-less');
      if (!more && !less) return;
      const expanded = !!more;
      const tr = e.target.closest('tr');
      const td = e.target.closest('td');
      const checkKey = tr?.dataset.key;
      const row = DStore.current()?.rows?.[checkKey];
      if (!row || !td || !checkKey) return;

      // Mo hang neu dang thu nho — tranh Show more bi overflow an
      if (expanded && tr.classList.contains('dl-row-collapsed') && window.DTableResize?.setCollapsed) {
        DTableResize.setCollapsed(tr, false);
        const btn = tr.querySelector('.dl-row-toggle');
        if (btn) {
          btn.textContent = '▴';
          btn.setAttribute('aria-expanded', 'true');
        }
      }

      const clip = td.querySelector('.dl-cell-clip') || td;
      if (td.classList.contains('cell-b')) {
        const key = DRender.cellExpandKey(checkKey, 'config');
        DRender.setCellExpanded(key, expanded);
        clip.innerHTML = DRender.fieldsHtml(row.config, { expanded });
        return;
      }
      if (td.classList.contains('cell-site') && td.dataset.site) {
        const key = DRender.cellExpandKey(checkKey, 'site', td.dataset.site);
        DRender.setCellExpanded(key, expanded);
        clip.innerHTML = DRender.siteCell(row.sites?.[td.dataset.site], { expanded });
      }
    });

    initWindowChrome();
    initLogResize();
    if (window.DTableResize) DTableResize.init();
    DRender.head();
  }

  return { init, open, close, toggle, handleEvent, isOpen: () => isOpen };
})();
