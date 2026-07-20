/**
 * Nut Chay / Dung / Detail Log + nhan su kien tien do tu main process.
 *
 * Nut Dung bat khi:
 *  - Dang chay check/test, HOAC
 *  - Con browser profile mo (autoClose=false, check xong nhung chua dong).
 */
window.RunnerUI = (() => {
  let currentRunId = 0;
  let startGen = 0;
  let leftoverOpen = 0;

  function syncStopButtons() {
    const canStop = State.running || leftoverOpen > 0;
    $('#btn-stop').disabled = !canStop;
  }

  function setRunning(on) {
    State.running = on;
    $('#btn-run').disabled = on;
    $('#btn-test').disabled = on;
    $('#tab-cloud').disabled = on;
    $('#tab-local').disabled = on;
    $('#btn-reload').disabled = on;
    syncStopButtons();
  }

  function setProgress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('#progress-bar').style.width = pct + '%';
    $('#progress-text').textContent = `${done}/${total} (${pct}%)`;
  }

  /**
   * @param {'check'|'testLane'} mode
   */
  async function start(mode) {
    if (State.running) {
      return logLine(t('log.alreadyRunning'), 'warn');
    }

    const profiles = Table.selectedProfiles();
    const checkKeys = Settings.getCheckKeys();
    const threads = Settings.getThreads();

    if (!profiles.length) return logLine(t('log.noProfile'), 'warn');
    if (mode === 'check' && !checkKeys.length) {
      return logLine(t('log.noChecks'), 'warn');
    }

    const gen = ++startGen;
    leftoverOpen = 0;
    Table.resetStatus();
    setRunning(true);
    setProgress(0, profiles.length);
    DetailLog.open();

    if (mode === 'testLane') {
      const sec = Settings.getTestWaitSec();
      logLine(t('log.testStart', { n: profiles.length, threads, sec }));
      logLine(t('log.testHint', { threads }), 'warn');
    } else {
      logLine(t('log.checkStart', { n: profiles.length, checks: checkKeys.length, threads }));
      logLine(t('check.targetOs', { os: Settings.getTargetOs() }), 'ok');
    }

    try {
      const res = await window.api.run.start({ profiles, checkKeys, threads, mode });
      if (!res.ok) logLine(t('log.error', { error: res.error }), 'err');
    } catch (err) {
      logLine(t('log.error', { error: err?.message || err }), 'err');
    } finally {
      if (gen === startGen) setRunning(false);
    }
  }

  async function stop() {
    if (!State.running && leftoverOpen <= 0) return;
    logLine(t('log.stopSent'), 'warn');
    const res = await window.api.run.stop();
    if (res && res.closed > 0) {
      leftoverOpen = 0;
      syncStopButtons();
      logLine(t('log.closedOpen', { n: res.closed }), 'ok');
    }
  }

  function onEvent(evt) {
    DetailLog.handleEvent(evt);

    if (evt.type === 'start' && typeof evt.runId === 'number') {
      currentRunId = evt.runId;
      leftoverOpen = 0;
      setRunning(true);
    } else if (typeof evt.runId === 'number' && currentRunId && evt.runId !== currentRunId) {
      return;
    }

    switch (evt.type) {
      case 'start':
        logLine(t('log.startInfo', { runId: evt.runId, mode: evt.mode, threads: evt.threads }));
        break;
      case 'profile-start':
        Table.setStatus(evt.uuid, 'running');
        break;
      case 'profile-error':
        logLine(`[lane #${evt.laneId}] ${evt.uuid}: ${evt.error}`, 'err');
        // Profile da xoa / mo that bai -> bo tick de lan sau khong chay lai
        if (evt.stage === 'open' && typeof ProfileSource !== 'undefined') {
          if (ProfileSource.unselect(evt.uuid)) {
            logLine(t('log.unselectedMissing', { uuid: evt.uuid }), 'warn');
          }
        }
        break;
      case 'profile-done':
        Table.setStatus(evt.uuid, evt.status, evt.statusText);
        break;
      case 'profile-closed':
        if (leftoverOpen > 0) leftoverOpen--;
        syncStopButtons();
        break;
      case 'progress':
        setProgress(evt.done, evt.total);
        break;
      case 'log':
        logLine(`[lane #${evt.laneId}] ${evt.message}`, evt.kind);
        break;
      case 'finish': {
        if (typeof evt.runId !== 'number' && !State.running) break;
        leftoverOpen = evt.leftoverOpenCount || (evt.leftoverOpen && evt.leftoverOpen.length) || 0;
        setRunning(false);
        if (leftoverOpen > 0) {
          logLine(t('log.leftoverOpen', { n: leftoverOpen }), 'warn');
        }
        if (evt.error) return logLine(t('log.finishError', { error: evt.error }), 'err');
        const s = evt.summary || {};
        logLine(
          t('log.finish', {
            stopped: evt.stopped ? t('log.stoppedSuffix') : '',
            pass: s.pass || 0,
            fail: s.fail || 0,
            error: s.error || 0,
          }),
          s.fail || s.error ? 'warn' : 'ok'
        );
        break;
      }
      case 'stop-done': {
        if (!evt.hasOpen) leftoverOpen = 0;
        syncStopButtons();
        break;
      }
    }
  }

  function init() {
    $('#btn-run').addEventListener('click', () => start('check'));
    $('#btn-test').addEventListener('click', () => start('testLane'));
    $('#btn-stop').addEventListener('click', stop);
    $('#btn-detail').addEventListener('click', () => DetailLog.toggle());
    window.api.run.onEvent(onEvent);
  }

  return { init, setRunning, stop };
})();
