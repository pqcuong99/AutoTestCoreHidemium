/**
 * Nguon profile: goi Local API cua Hidemium thay vi doc file Excel/CSV.
 *
 *   Cloud -> GET /v1/browser/list?is_local=false&page=N
 *   Local -> GET /v1/browser/list?is_local=true&page=N
 *
 * Tab dang chon duoc luu vao config (sourceMode) -> mo app lan sau vao dung tab cu.
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
    $('#btn-reload').disabled = on;
    $('#source-info').textContent = on ? 'Dang tai...' : $('#source-info').textContent;
  }

  /**
   * Tai 1 trang profile.
   * @param {{source?:string, page?:number, silent?:boolean}} opts
   */
  async function load({ source = State.source, page = 1, silent = false } = {}) {
    if (loading || State.running) return false;
    setLoading(true);

    const res = await window.api.profiles.list({ source, page });
    setLoading(false);

    if (!res.ok) {
      // Van giu tab dang chon sang - loi API khong lam doi tab.
      State.rows = [];
      State.meta = { currentPage: 1, lastPage: 1, total: 0 };
      $('#source-info').textContent = `Khong tai duoc (${LABEL[source]})`;
      Table.render();
      renderPager();
      if (!silent) logLine(`Loi tai profile (${LABEL[source]}): ${res.error}`, 'err');
      return false;
    }

    State.source = res.source;
    State.page = res.meta.currentPage;
    State.meta = res.meta;
    State.rows = res.rows;
    State.status = {};
    State.statusText = {};

    // Tick khoi phuc tu config chua co ten -> bu lai khi trang chua no duoc tai.
    res.rows.forEach((r) => {
      if (State.selected.has(r.uuid)) State.selected.set(r.uuid, { uuid: r.uuid, name: r.name });
    });

    setTabs(State.source);
    $('#source-info').textContent =
      `${res.meta.total} profile - trang ${res.meta.currentPage}/${res.meta.lastPage}`;

    Table.render();
    renderPager();
    logLine(
      `Da tai ${res.rows.length} profile (${LABEL[State.source]}) - trang ${res.meta.currentPage}/${res.meta.lastPage}.`,
      'ok'
    );
    return true;
  }

  /** Doi tab -> luon ve trang 1 va bo tick cu (danh sach khac hoan toan). */
  async function switchSource(source) {
    if (source === State.source || loading || State.running) return;

    // Sang tab ngay khi bam: nguoi dung phai thay minh dang o dau, ke ca khi API loi.
    State.source = source;
    State.page = 1;
    setTabs(source);

    State.selected.clear();
    Table.persistSelection();
    await load({ source, page: 1 });
  }

  /** Cac so trang can hien: luon co 1 va last, cong cua so quanh trang hien tai. */
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

  function init() {
    $('#tab-cloud').addEventListener('click', () => switchSource('cloud'));
    $('#tab-local').addEventListener('click', () => switchSource('local'));
    $('#btn-reload').addEventListener('click', () => load({ page: State.page }));

    $('#pager').addEventListener('click', (e) => {
      const btn = e.target.closest('.pg');
      if (!btn || btn.disabled) return;
      const page = Number(btn.dataset.page);
      if (page && page !== State.meta.currentPage) load({ page });
    });
  }

  return { init, load, setTabs, renderPager };
})();
