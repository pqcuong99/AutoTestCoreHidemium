/**
 * Nut Chay / Dung / Detail Log + nhan su kien tien do tu main process.
 */
window.RunnerUI = (() => {
  let currentRunId = 0;

  function setRunning(on) {
    State.running = on;
    $('#btn-run').disabled = on;
    $('#btn-test').disabled = on;
    $('#btn-stop').disabled = !on;
    $('#tab-cloud').disabled = on;
    $('#tab-local').disabled = on;
    $('#btn-reload').disabled = on;
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
    const profiles = Table.selectedProfiles();
    const checkKeys = Settings.getCheckKeys();
    const threads = Settings.getThreads();

    if (!profiles.length) return logLine('Chua tick profile nao.', 'warn');
    if (mode === 'check' && !checkKeys.length) {
      return logLine('Chua chon muc check nao trong Setting.', 'warn');
    }

    Table.resetStatus();
    setRunning(true);
    setProgress(0, profiles.length);
    DetailLog.open(); // bam Chay -> mo popup Detail Log

    if (mode === 'testLane') {
      const sec = Settings.getTestWaitSec();
      logLine(`TEST LUONG: ${profiles.length} profile, ${threads} luong, giu mo ${sec}s roi dong.`);
      logLine(`Nhin man hinh: toi da ${threads} browser mo cung luc moi la dung.`, 'warn');
    } else {
      logLine(`Bat dau: ${profiles.length} profile, ${checkKeys.length} muc check, ${threads} luong.`);
    }

    const res = await window.api.run.start({ profiles, checkKeys, threads, mode });
    if (!res.ok) logLine('Loi: ' + res.error, 'err');
  }

  async function stop() {
    await window.api.run.stop();
    logLine('Da gui lenh dung...', 'warn');
  }

  function onEvent(evt) {
    // Popup nhan MOI su kien, ke ca khi dang dong -> mo len la co du du lieu.
    DetailLog.handleEvent(evt);

    // Bo qua su kien cua lan chay cu
    if (typeof evt.runId === 'number' && currentRunId && evt.runId !== currentRunId) return;

    switch (evt.type) {
      case 'start':
        currentRunId = evt.runId;
        logLine(`runId ${evt.runId} - che do "${evt.mode}" - ${evt.threads} lane san sang.`);
        break;
      case 'profile-start':
        Table.setStatus(evt.uuid, 'running');
        break;
      case 'profile-error':
        logLine(`[lane #${evt.laneId}] ${evt.uuid}: ${evt.error}`, 'err');
        break;
      case 'profile-done':
        Table.setStatus(evt.uuid, evt.status, evt.statusText);
        break;
      case 'progress':
        setProgress(evt.done, evt.total);
        break;
      case 'log':
        logLine(`[lane #${evt.laneId}] ${evt.message}`, evt.kind);
        break;
      case 'finish': {
        setRunning(false);
        if (evt.error) return logLine('Ket thuc voi loi: ' + evt.error, 'err');
        const s = evt.summary || {};
        logLine(
          `Hoan tat${evt.stopped ? ' (bi dung)' : ''}: PASS ${s.pass || 0} / FAIL ${s.fail || 0} / LOI ${s.error || 0}`,
          s.fail || s.error ? 'warn' : 'ok'
        );
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

  return { init, setRunning };
})();
