/**
 * CHE DO TEST LUONG.
 *
 * Chi kiem tra profile mo/dong + lane chay duoc — khong doc config, khong scrape site.
 * Moi profile: mo -> doi N giay -> dong.
 */
const { openProfile, closeProfile } = require('../hidemiumApi');
const { t } = require('../../shared/i18n');

/** Sleep co the huy giua chung khi bam Dung. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {import('../laneManager').Lane} lane
 * @param {string[]} _checkKeys
 * @param {{ signal:AbortSignal, emit:(e:object)=>void, options:object }} ctx
 */
async function runProfileCheck(lane, _checkKeys, ctx) {
  const { uuid, name } = lane.job;
  const { signal, emit, options } = ctx;
  const waitMs = Number(options.testWaitMs) || 10000;
  const step = (message, kind) => emit({ type: 'log', uuid, message, kind });

  const t0 = Date.now();
  step(t('check.testOpening', { laneId: lane.id, name: name || uuid }));

  const opened = await openProfile(uuid, { baseUrl: options.apiBase, signal });
  lane.assertOwns(uuid);

  if (!opened.ok) {
    emit({ type: 'profile-error', uuid, stage: 'open', error: opened.error });
    return { ok: false, status: t('err.openProfile'), error: opened.error, rows: {} };
  }

  lane.ctx.openData = opened.data;
  emit({ type: 'profile-opened', uuid, data: opened.data });
  step(t('check.testOpened', { ms: Date.now() - t0, port: opened.data.remote_port }), 'ok');

  let closeErr = null;
  try {
    step(t('check.testHold', { sec: waitMs / 1000 }));
    await sleep(waitMs, signal);
    lane.assertOwns(uuid);
  } finally {
    step(t('check.closing'));
    const closed = await closeProfile(uuid, { baseUrl: options.apiBase });
    lane.assertOwns(uuid);

    if (closed.ok) {
      step(t('check.testClosed', { ms: Date.now() - t0 }), 'ok');
      emit({ type: 'profile-closed', uuid });
    } else {
      closeErr = closed.error;
      step(t('check.closeFail', { error: closed.error }), 'err');
      emit({ type: 'profile-error', uuid, stage: 'close', error: closed.error });
    }
  }

  if (closeErr) return { ok: false, status: t('err.closeProfile'), error: closeErr, rows: {} };
  return { ok: true, status: t('err.testOk'), rows: {} };
}

module.exports = { runProfileCheck };
