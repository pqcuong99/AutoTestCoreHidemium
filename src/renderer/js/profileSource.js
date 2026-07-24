/**
 * Nguon profile: goi Local API cua Hidemium.
 *
 *   Cloud -> POST /v1/browser/list?is_local=false  body { page, limit, search }
 *   Local -> POST /v1/browser/list?is_local=true   body { page, limit, search }
 *   (Local khong chap nhan GET — se tra Get browser failed!)
 *
 * Tab dang chon duoc luu vao config (sourceMode) -> mo app lan sau vao dung tab cu.
 * Khi reload / mo app: quet toan bo trang de bo tick UUID da bi xoa ben Hidemium
 * (tranh bam Chay van mo profile chet -> loi "mo profile" tren Detail Log).
 *
 * Phan trang UI: fetch het API pages -> loc theo targetOs (+ search) -> slice pageSize.
 * Tranh trang API toan Win chi con 1-2 Mac sau khi loc OS.
 */
window.ProfileSource = (() => {
  let loading = false;

  /** Lua chon so profile / trang UI (sau khi loc OS). */
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
  const DEFAULT_PAGE_SIZE = 20;

  const LABEL = { cloud: 'Cloud', local: 'Local' };

  function getPageSize() {
    const raw = State.config?.pageSize ?? State.meta?.perPage ?? DEFAULT_PAGE_SIZE;
    const n = Number(raw);
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
  }

  function setPageSize(next) {
    const n = Number(next);
    const size = PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
    if (State.config) State.config.pageSize = size;
    window.api?.config?.set?.({ pageSize: size });
    State.meta = { ...(State.meta || {}), perPage: size };
    return size;
  }

  function setTabs(source) {
    $('#tab-cloud').classList.toggle('active', source === 'cloud');
    $('#tab-local').classList.toggle('active', source === 'local');
  }

  function setLoading(on) {
    loading = on;
    $('#btn-reload').disabled = on || State.running;
    if (on) $('#source-info').textContent = t('log.loading');
  }

  function currentTargetOs() {
    return (
      (typeof Settings !== 'undefined' && Settings.getTargetOs && Settings.getTargetOs()) ||
      'windows'
    );
  }

  function filterByOs(rows) {
    const targetOs = currentTargetOs();
    if (!window.ProfileOs || targetOs === 'all') return rows;
    return rows.filter((r) => window.ProfileOs.profileMatchesTargetOs(r.os, targetOs));
  }

  function filterBySearch(rows) {
    const q = String(State.filter || '')
      .trim()
      .toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.uuid.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }

  /**
   * Loc allRows theo OS + search, roi slice trang UI.
   * @param {number} [page]
   */
  function applyView(page = State.page || 1) {
    const filtered = filterBySearch(filterByOs(State.allRows || []));
    const pageSize = getPageSize();
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
    const p = Math.min(Math.max(1, Number(page) || 1), lastPage);
    const start = (p - 1) * pageSize;
    State.rows = filtered.slice(start, start + pageSize);
    State.page = p;
    State.meta = {
      currentPage: p,
      lastPage,
      perPage: pageSize,
      total: filtered.length,
    };
  }

  /**
   * Tai toan bo trang API (limit do Hidemium khoa 10/15).
   * @returns {{ ok:boolean, rows?:Array, error?:string, source?:string }}
   */
  async function fetchAllRows(source) {
    const all = [];
    let page = 1;
    let lastPage = 1;
    let mode = source;

    while (page <= lastPage) {
      const res = await window.api.profiles.list({ source, page });
      if (!res.ok) {
        return { ok: false, error: res.error, source: res.source || source };
      }
      mode = res.source || source;
      lastPage = Math.max(1, res.meta?.lastPage || 1);
      for (const r of res.rows || []) all.push(r);
      page++;
    }

    return { ok: true, rows: all, source: mode };
  }

  /**
   * Doi chieu State.selected voi danh sach that tu API (moi trang).
   * @returns {number} so tick da bo vi khong con ton tai
   */
  async function pruneMissingSelections(source = State.source) {
    const wanted = Array.from(State.selected.keys());
    if (!wanted.length) return 0;

    const pool = State.allRows?.length
      ? State.allRows
      : (await fetchAllRows(source)).rows || [];

    const found = new Map();
    const wantedSet = new Set(wanted);
    for (const r of pool) {
      if (wantedSet.has(r.uuid)) {
        found.set(r.uuid, {
          uuid: r.uuid,
          name: r.name,
          os: r.os || '',
          browser: r.browser || '',
          coreVersion: r.coreVersion || '',
        });
      }
    }

    let removed = 0;
    for (const uuid of wanted) {
      if (found.has(uuid)) {
        State.selected.set(uuid, found.get(uuid));
      } else {
        State.selected.delete(uuid);
        delete State.status[uuid];
        delete State.statusText[uuid];
        removed++;
      }
    }

    if (removed) Table.persistSelection();
    return removed;
  }

  /**
   * Chi cap nhat slice trang (khong fetch lai API) — dung khi doi OS / search.
   */
  function refreshView({ page = 1 } = {}) {
    applyView(page);
    Table.pruneSelectionByTargetOs?.();
    Table.render();
    Table.updateCount();
    renderPager();
    $('#source-info').textContent = t('log.loadedInfo', {
      total: State.meta.total,
      page: State.meta.currentPage,
      last: State.meta.lastPage,
    });
  }

  /**
   * Tai danh sach profile (fetch het API) roi hien 1 trang UI.
   * @param {{source?:string, page?:number, silent?:boolean, pruneSelection?:boolean}} opts
   *   pruneSelection: true khi reload / bootstrap — bo tick profile da xoa
   */
  async function load({ source = State.source, page = 1, silent = false, pruneSelection = false } = {}) {
    if (loading || State.running) return false;
    setLoading(true);

    const res = await fetchAllRows(source);

    if (!res.ok) {
      setLoading(false);
      State.allRows = [];
      State.rows = [];
      State.meta = { currentPage: 1, lastPage: 1, total: 0, perPage: getPageSize() };
      $('#source-info').textContent = t('log.loadFailInfo', { source: LABEL[source] });
      Table.render();
      renderPager();
      if (!silent) logLine(t('log.loadFail', { source: LABEL[source], error: res.error }), 'err');
      return false;
    }

    State.source = res.source;
    State.allRows = res.rows;
    applyView(page);

    State.status = {};
    State.statusText = {};

    State.rows.forEach((r) => {
      if (State.selected.has(r.uuid)) {
        State.selected.set(r.uuid, {
          uuid: r.uuid,
          name: r.name,
          os: r.os || '',
          browser: r.browser || '',
          coreVersion: r.coreVersion || '',
        });
      }
    });

    let pruned = 0;
    if (pruneSelection && State.selected.size) {
      pruned = await pruneMissingSelections(State.source);
    }
    Table.pruneSelectionByTargetOs?.();
    // prune co the doi selected; slice lai neu can
    applyView(State.page);

    setLoading(false);
    setTabs(State.source);
    $('#source-info').textContent = t('log.loadedInfo', {
      total: State.meta.total,
      page: State.meta.currentPage,
      last: State.meta.lastPage,
    });

    Table.render();
    Table.updateCount();
    renderPager();
    if (!silent) {
      logLine(
        t('log.loaded', {
          n: State.rows.length,
          source: LABEL[State.source],
          page: State.meta.currentPage,
          last: State.meta.lastPage,
        }),
        'ok'
      );
      if (pruned > 0) {
        logLine(t('log.prunedSelection', { n: pruned }), 'warn');
      }
    }
    return true;
  }

  async function switchSource(source) {
    if (source === State.source || loading || State.running) return;

    State.source = source;
    State.page = 1;
    setTabs(source);

    State.selected.clear();
    Table.persistSelection();
    await load({ source, page: 1 });
  }

  function pageNumbers(current, last) {
    const out = new Set([1, last]);
    for (let p = current - 2; p <= current + 2; p++) {
      if (p >= 1 && p <= last) out.add(p);
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  function renderPager() {
    const { currentPage, lastPage, total } = State.meta;
    const box = $('#pager');
    if (!box) return;

    // Khong co data → an pager
    if (!total && !(State.allRows || []).length) {
      box.innerHTML = '';
      return;
    }

    const pageSize = getPageSize();
    const sizeOpts = PAGE_SIZE_OPTIONS.map(
      (n) => `<option value="${n}" ${n === pageSize ? 'selected' : ''}>${n}</option>`
    ).join('');

    let html = `<label class="pager-size" title="${escapeHtml(t('pager.pageSizeTitle'))}">`;
    html += `<select id="sel-page-size" aria-label="${escapeHtml(t('pager.pageSizeTitle'))}">${sizeOpts}</select>`;
    html += `<span>${escapeHtml(t('pager.pageSize'))}</span></label>`;

    if (lastPage > 1) {
      const nums = pageNumbers(currentPage, lastPage);
      html += `<div class="pager-pages">`;
      html += `<button class="pg" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>&lsaquo;</button>`;
      nums.forEach((p, i) => {
        if (i > 0 && p - nums[i - 1] > 1) html += `<span class="pg-gap">...</span>`;
        html += `<button class="pg ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
      });
      html += `<button class="pg" data-page="${currentPage + 1}" ${currentPage >= lastPage ? 'disabled' : ''}>&rsaquo;</button>`;
      html += `</div>`;
    }

    box.innerHTML = html;
  }

  /** Go tick 1 uuid (vd khi open profile that bai / profile da xoa). */
  function unselect(uuid) {
    if (!uuid || !State.selected.has(uuid)) return false;
    State.selected.delete(uuid);
    Table.persistSelection();
    Table.updateCount();
    Table.render();
    return true;
  }

  function init() {
    $('#tab-cloud').addEventListener('click', () => switchSource('cloud'));
    $('#tab-local').addEventListener('click', () => switchSource('local'));
    // Reload: luon prune tick chet
    $('#btn-reload').addEventListener('click', () =>
      load({ page: State.page, pruneSelection: true })
    );

    const pager = $('#pager');
    pager.addEventListener('click', (e) => {
      const btn = e.target.closest('.pg');
      if (!btn || btn.disabled) return;
      const page = Number(btn.dataset.page);
      if (!page || page === State.meta.currentPage) return;
      // Da co allRows — chi slice lai, khong fetch API
      applyView(page);
      Table.render();
      Table.updateCount();
      renderPager();
      $('#source-info').textContent = t('log.loadedInfo', {
        total: State.meta.total,
        page: State.meta.currentPage,
        last: State.meta.lastPage,
      });
    });

    pager.addEventListener('change', (e) => {
      const sel = e.target.closest('#sel-page-size');
      if (!sel) return;
      setPageSize(sel.value);
      refreshView({ page: 1 });
    });
  }

  return {
    init,
    load,
    setTabs,
    renderPager,
    pruneMissingSelections,
    unselect,
    refreshView,
    getPageSize,
    PAGE_SIZE_OPTIONS,
  };
})();
