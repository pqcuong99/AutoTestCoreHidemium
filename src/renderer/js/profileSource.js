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
 */
window.ProfileSource = (() => {
  let loading = false;

  const LABEL = { cloud: 'Cloud', local: 'Local' };

  function setTabs(source) {
    $('#tab-cloud').classList.toggle('active', source === 'cloud');
    $('#tab-local').classList.toggle('active', source === 'local');
  }

  function setLoading(on) {
    loading = on;
    $('#btn-reload').disabled = on || State.running;
    if (on) $('#source-info').textContent = t('log.loading');
  }

  /**
   * Doi chieu State.selected voi danh sach that tu API (moi trang).
   * @returns {number} so tick da bo vi khong con ton tai
   */
  async function pruneMissingSelections(source = State.source) {
    const wanted = Array.from(State.selected.keys());
    if (!wanted.length) return 0;

    const wantedSet = new Set(wanted);
    const found = new Map(); // uuid -> { uuid, name }
    let page = 1;
    let lastPage = 1;

    while (page <= lastPage) {
      const res = await window.api.profiles.list({ source, page });
      if (!res.ok) break;
      lastPage = Math.max(1, res.meta?.lastPage || 1);
      for (const r of res.rows || []) {
        if (wantedSet.has(r.uuid)) found.set(r.uuid, { uuid: r.uuid, name: r.name });
      }
      if (found.size === wantedSet.size) break;
      page++;
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
   * Tai 1 trang profile.
   * @param {{source?:string, page?:number, silent?:boolean, pruneSelection?:boolean}} opts
   *   pruneSelection: true khi reload / bootstrap — bo tick profile da xoa
   */
  async function load({ source = State.source, page = 1, silent = false, pruneSelection = false } = {}) {
    if (loading || State.running) return false;
    setLoading(true);

    const res = await window.api.profiles.list({ source, page });

    if (!res.ok) {
      setLoading(false);
      State.rows = [];
      State.meta = { currentPage: 1, lastPage: 1, total: 0 };
      $('#source-info').textContent = t('log.loadFailInfo', { source: LABEL[source] });
      Table.render();
      renderPager();
      if (!silent) logLine(t('log.loadFail', { source: LABEL[source], error: res.error }), 'err');
      return false;
    }

    State.source = res.source;
    State.page = res.meta.currentPage;
    State.meta = res.meta;
    State.rows = res.rows;
    State.status = {};
    State.statusText = {};

    res.rows.forEach((r) => {
      if (State.selected.has(r.uuid)) State.selected.set(r.uuid, { uuid: r.uuid, name: r.name });
    });

    let pruned = 0;
    if (pruneSelection && State.selected.size) {
      pruned = await pruneMissingSelections(State.source);
    }

    setLoading(false);
    setTabs(State.source);
    $('#source-info').textContent = t('log.loadedInfo', {
      total: res.meta.total,
      page: res.meta.currentPage,
      last: res.meta.lastPage,
    });

    Table.render();
    Table.updateCount();
    renderPager();
    if (!silent) {
      logLine(
        t('log.loaded', {
          n: res.rows.length,
          source: LABEL[State.source],
          page: res.meta.currentPage,
          last: res.meta.lastPage,
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
    const { currentPage, lastPage } = State.meta;
    const box = $('#pager');

    if (!lastPage || lastPage <= 1) {
      box.innerHTML = '';
      return;
    }

    const nums = pageNumbers(currentPage, lastPage);
    let html = `<button class="pg" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>&lsaquo;</button>`;

    nums.forEach((p, i) => {
      if (i > 0 && p - nums[i - 1] > 1) html += `<span class="pg-gap">...</span>`;
      html += `<button class="pg ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    });

    html += `<button class="pg" data-page="${currentPage + 1}" ${currentPage >= lastPage ? 'disabled' : ''}>&rsaquo;</button>`;
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

    $('#pager').addEventListener('click', (e) => {
      const btn = e.target.closest('.pg');
      if (!btn || btn.disabled) return;
      const page = Number(btn.dataset.page);
      if (page && page !== State.meta.currentPage) load({ page });
    });
  }

  return { init, load, setTabs, renderPager, pruneMissingSelections, unselect };
})();
