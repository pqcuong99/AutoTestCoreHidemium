/**
 * State cua man Detail Log.
 *
 * Cach ly du lieu giua cac luong o phia renderer:
 *  - Moi profile co 1 "record" rieng, khoa bang uuid. Khong co bien dung chung nao
 *    bi ghi de giua cac luong.
 *  - Su kien mang runId khac runId hien tai -> BO QUA (rac cua lan chay truoc).
 *  - Su kien mang laneId -> luu vao record de biet profile nao dang o lane nao.
 */
window.DStore = (() => {
  const state = {
    runId: 0,
    running: false,
    lanes: [],                 // [{laneId, busy, uuid, name}]
    order: [],                 // thu tu uuid de ve sidebar
    records: new Map(),        // uuid -> record
    current: null,             // uuid dang xem
    checkKeys: [],
    follow: true,              // tu nhay sang profile vua bat dau chay
    mode: 'check',
    progress: '',              // set qua t('status.ready') khi reset / apply locale
  };

  function blankRecord(uuid, name) {
    return {
      uuid,
      name: name || '',
      laneId: null,
      status: 'idle',          // idle | running | pass | fail | error | stopped
      statusText: '',          // vd 'error open profile'
      open: null,              // data tu openProfile
      rows: {},                // checkKey -> { config, sites }
      logs: [],
      error: '',
    };
  }

  function reset(runId, profiles, checkKeys) {
    state.runId = runId;
    state.checkKeys = checkKeys || [];
    state.order = [];
    state.records = new Map();
    state.progress = typeof t === 'function' ? t('status.ready') : '';
    (profiles || []).forEach((p) => {
      state.order.push(p.uuid);
      state.records.set(p.uuid, blankRecord(p.uuid, p.name));
    });
    state.current = state.order[0] || null;
  }

  /** Chi nhan su kien cua lan chay hien tai. */
  function accepts(evt) {
    if (!evt || typeof evt.runId !== 'number') return true; // su kien khong gan runId (finish loi)
    if (state.runId === 0) return true;
    return evt.runId === state.runId;
  }

  function record(uuid, name) {
    if (!uuid) return null;
    if (!state.records.has(uuid)) {
      state.records.set(uuid, blankRecord(uuid, name));
      state.order.push(uuid);
    }
    const r = state.records.get(uuid);
    if (name && !r.name) r.name = name;
    return r;
  }

  function get(uuid) {
    return state.records.get(uuid) || null;
  }

  function current() {
    return state.current ? get(state.current) : null;
  }

  function setCurrent(uuid) {
    state.current = uuid;
  }

  return { state, reset, accepts, record, get, current, setCurrent, blankRecord };
})();
