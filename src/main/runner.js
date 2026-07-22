/**
 * Runner: dieu phoi N lane chay song song.
 *
 * Quan ly luong:
 *  - Tao dung N lane, moi lane la 1 worker vong lap doc tu hang doi chung.
 *  - Worker i CHI dung lane i tu dau den cuoi -> khong co chuyen 2 profile chung 1 lane.
 *  - Moi su kien phat ra deu duoc bo sung { runId, laneId, seq } tai day (1 cho duy nhat).
 *  - runId tang moi lan bam Chay -> renderer bo qua su kien cua lan chay cu.
 *  - Theo doi profile dang mo: bam Dung (ke ca sau khi check xong) se dong het.
 */
const { LaneManager } = require('./laneManager');
const { closeProfile } = require('./hidemiumApi');
const { t } = require('../shared/i18n');

/** Cac che do chay. Them che do moi -> them 1 dong o day. */
const PIPELINES = {
  check: require('./checks').runProfileCheck,        // check that
  testLane: require('./checks/testLane').runProfileCheck, // mo -> doi 10s -> dong
};

class Runner {
  constructor() {
    this.running = false;
    this.controller = null;
    this.manager = null;
    this.runId = 0;
    /** @type {Set<string>} uuid profile con dang mo (autoClose=false) */
    this.opened = new Set();
    this.apiBase = '';
  }

  /**
   * @param {object} params
   * @param {Array} params.profiles
   * @param {string[]} params.checkKeys
   * @param {number} params.threads
   * @param {object} params.options  { apiBase, autoClose }
   * @param {(evt:object)=>void} onEvent
   */
  async start({ profiles, checkKeys, threads, options = {} }, onEvent) {
    const mode = options.mode || 'check';
    const runProfileCheck = PIPELINES[mode];
    if (!runProfileCheck) throw new Error(t('err.invalidMode', { mode }));

    if (this.running) throw new Error(t('err.alreadyRunning'));
    if (!profiles?.length) throw new Error(t('err.noProfile'));
    if (mode === 'check' && !checkKeys?.length) throw new Error(t('err.noChecks'));

    // Lan chay moi: dong so profile con sot tu lan truoc (neu co).
    if (this.opened.size) await this.closeOpened(options.apiBase);

    const runId = ++this.runId;
    this.running = true;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.apiBase = options.apiBase || '';

    const concurrency = Math.max(1, Math.min(Number(threads) || 1, profiles.length));
    const manager = new LaneManager(runId, concurrency);
    this.manager = manager;

    const queue = profiles.map((p, i) => ({ ...p, order: i + 1 }));
    const summary = { total: profiles.length, pass: 0, fail: 0, error: 0, stopped: 0 };
    let done = 0;

    const emitFrom = (lane) => (evt) => {
      this._trackOpen(evt);
      onEvent({ ...evt, runId, laneId: lane.id, seq: manager.nextSeq() });
    };

    const emitGlobal = (evt) => {
      this._trackOpen(evt);
      onEvent({ ...evt, runId, seq: manager.nextSeq() });
    };

    emitGlobal({
      type: 'start',
      mode,
      total: profiles.length,
      threads: concurrency,
      checkKeys,
      lanes: manager.snapshot(),
      profiles: profiles.map((p) => ({
        uuid: p.uuid,
        name: p.name,
        os: p.os || '',
        browser: p.browser || '',
      })),
    });

    const worker = async (lane) => {
      while (!signal.aborted) {
        const profile = queue.shift();
        if (!profile) break;

        const emit = emitFrom(lane);
        lane.bind(profile);
        emit({ type: 'profile-start', uuid: profile.uuid, name: profile.name, order: profile.order });

        let status = 'error';
        let statusText = '';
        try {
          const res = await runProfileCheck(lane, checkKeys, { signal, emit, options });
          lane.assertOwns(profile.uuid);
          status = res.ok ? 'pass' : 'fail';
          statusText = res.status || '';
          if (res.ok) summary.pass++;
          else {
            summary.fail++;
            emit({ type: 'log', uuid: profile.uuid, message: res.error || res.status, kind: 'err' });
          }
        } catch (err) {
          if (signal.aborted) {
            status = 'stopped';
            summary.stopped++;
          } else {
            status = 'error';
            summary.error++;
            emit({ type: 'log', uuid: profile.uuid, message: t('err.prefix', { message: err.message }), kind: 'err' });
          }
        } finally {
          emit({ type: 'profile-done', uuid: profile.uuid, status, statusText });
          lane.release();
          done++;
          emitGlobal({ type: 'progress', done, total: profiles.length, lanes: manager.snapshot() });
        }
      }
      emitGlobal({ type: 'lane-idle', laneId: lane.id });
    };

    await Promise.all(manager.lanes.map((lane) => worker(lane)));

    // Neu bi Dung giua chung -> dong het browser con mo.
    if (signal.aborted && this.opened.size) {
      await this.closeOpened(options.apiBase, emitGlobal);
    }

    manager.releaseAll();
    const stopped = signal.aborted;
    this.running = false;
    this.controller = null;
    this.manager = null;

    const leftoverOpen = [...this.opened];
    emitGlobal({
      type: 'finish',
      summary,
      stopped,
      leftoverOpen,
      leftoverOpenCount: leftoverOpen.length,
    });
    return summary;
  }

  _trackOpen(evt) {
    if (evt.type === 'profile-opened' && evt.uuid) this.opened.add(evt.uuid);
    if (evt.type === 'profile-closed' && evt.uuid) this.opened.delete(evt.uuid);
  }

  /**
   * Dong tat ca profile dang mo. Dung khi bam Dung / bat dau lan chay moi.
   */
  async closeOpened(apiBase = this.apiBase, emit) {
    const list = [...this.opened];
    for (const uuid of list) {
      try {
        await closeProfile(uuid, { baseUrl: apiBase });
      } catch (_) {
        /* ignore */
      }
      this.opened.delete(uuid);
      if (emit) emit({ type: 'profile-closed', uuid });
    }
    return list.length;
  }

  /**
   * Bam Dung: huy hang doi dang chay + dong profile con mo (ke ca sau khi check xong).
   */
  async stop() {
    const wasRunning = this.running;
    if (this.controller) this.controller.abort();
    // Neu khong con running (check xong, browser con mo) -> dong ngay.
    if (!wasRunning && this.opened.size) {
      const n = await this.closeOpened();
      return { wasRunning, closed: n };
    }
    return { wasRunning, closed: 0 };
  }

  isRunning() {
    return this.running;
  }

  hasOpenProfiles() {
    return this.opened.size > 0;
  }

  lanes() {
    return this.manager ? this.manager.snapshot() : [];
  }
}

module.exports = new Runner();
