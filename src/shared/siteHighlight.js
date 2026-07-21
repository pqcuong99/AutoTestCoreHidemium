/**
 * Highlight / format ket qua so sanh site vs config — dung chung moi site runner.
 *
 * Main: require('./siteHighlight')
 * Renderer: <script src="../shared/siteHighlight.js"></script> → window.SiteHighlight
 *
 * Trang thai dong:
 *   ok           — khop config
 *   mismatch     — khac config (✗)
 *   noConfig     — co tren web, khong co / placeholder trong config (⚠ no config)
 *   missingOnWeb — co config that, web khong co / scrape rong (⚠ missing on web)
 *   info         — chi hien thi (vd config=default)
 *   skipped      — bo qua, thuong khong ve
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteHighlight = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STATUS = {
    OK: 'ok',
    MISMATCH: 'mismatch',
    NO_CONFIG: 'noConfig',
    MISSING_ON_WEB: 'missingOnWeb',
    INFO: 'info',
    SKIPPED: 'skipped',
  };

  /** Suffix text gan vao cuoi dong (fallback khi khong co lines[]). */
  const MARK = {
    [STATUS.MISMATCH]: ' ✗',
    [STATUS.NO_CONFIG]: ' ⚠ no config',
    [STATUS.MISSING_ON_WEB]: ' ⚠ missing on web',
  };

  /** CSS class tren .kv (renderer). */
  const CSS = {
    [STATUS.OK]: 'kv-ok',
    [STATUS.MISMATCH]: 'kv-mismatch',
    [STATUS.NO_CONFIG]: 'kv-no-config',
    [STATUS.MISSING_ON_WEB]: 'kv-missing-web',
    [STATUS.INFO]: 'kv-info',
    [STATUS.SKIPPED]: 'kv-skipped',
  };

  /**
   * Phan loai 1 field result tu site runner.
   * @param {{
   *   pass?: boolean,
   *   skipped?: boolean,
   *   noConfig?: boolean,
   *   missingOnWeb?: boolean,
   *   infoOnly?: boolean,
   *   expected?: string,
   *   actual?: string,
   * }} f
   */
  function classifyField(f) {
    if (!f) return STATUS.SKIPPED;
    if (f.noConfig) return STATUS.NO_CONFIG;
    if (f.missingOnWeb) return STATUS.MISSING_ON_WEB;
    if (f.infoOnly) return STATUS.INFO;
    if (f.skipped) {
      // config=default / show-only: van hien actual neu co
      if (String(f.actual || '').trim()) return STATUS.INFO;
      return STATUS.SKIPPED;
    }
    if (f.pass === false) return STATUS.MISMATCH;
    return STATUS.OK;
  }

  function shouldDisplay(f) {
    const s = classifyField(f);
    return (
      s === STATUS.OK ||
      s === STATUS.MISMATCH ||
      s === STATUS.NO_CONFIG ||
      s === STATUS.MISSING_ON_WEB ||
      s === STATUS.INFO
    );
  }

  function markFor(status) {
    return MARK[status] || '';
  }

  /**
   * Tao cac dong hien thi cho 1 field (co the nhieu dong features).
   * @returns {Array<{ text: string, status: string, label?: string, value?: string }>}
   */
  function formatFieldLines(f, opts) {
    const discoverMode = !!(opts && opts.discoverMode);
    const status = classifyField(f);
    if (!shouldDisplay(f) && status === STATUS.SKIPPED) return [];

    const label = f.label || f.configKey || '';
    const actual = String(f.actual || '').trim();
    const mark = markFor(status);

    if (status === STATUS.MISSING_ON_WEB) {
      const exp = String(f.expected || '').trim();
      const text = exp
        ? `${label}: (empty) — expect ${exp}${mark}`
        : `${label}: (empty)${mark}`;
      return [{ text, status, label, value: '(empty)' }];
    }

    if (!actual && status !== STATUS.NO_CONFIG) {
      return [];
    }

    const isFeatures =
      f.match === 'featureSet' ||
      /features/i.test(f.label || '') ||
      /features/i.test(f.configKey || '');

    if (actual.includes('\n') || isFeatures) {
      const rawLines = actual
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (discoverMode && isFeatures && f.expected) {
        const want = new Set(
          String(f.expected)
            .split(/[,;]+/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        return rawLines.map((l) => {
          const name = (l.split(':')[0] || '').trim().toLowerCase();
          const on = /:\s*true\s*$/i.test(l);
          let st = status === STATUS.MISMATCH ? STATUS.MISMATCH : STATUS.OK;
          if (want.size && on && !want.has(name)) st = STATUS.NO_CONFIG;
          if (want.size && want.has(name) && !on) st = STATUS.MISMATCH;
          if (status === STATUS.NO_CONFIG) st = STATUS.NO_CONFIG;
          const body = l.includes(':') ? l : `${label}: ${l}`;
          return {
            text: body + markFor(st),
            status: st,
            label: (l.split(':')[0] || label).trim(),
            value: l.includes(':') ? l.slice(l.indexOf(':') + 1).trim() : l,
          };
        });
      }

      return rawLines.map((l) => {
        const body = l.includes(':') ? l : `${label}: ${l}`;
        return {
          text: body + mark,
          status,
          label: (l.split(':')[0] || label).trim(),
          value: l.includes(':') ? l.slice(l.indexOf(':') + 1).trim() : l,
        };
      });
    }

    const displayVal = actual || '(empty)';
    return [
      {
        text: `${label}: ${displayVal}${mark}`,
        status,
        label,
        value: displayVal,
      },
    ];
  }

  /**
   * Gom fieldResults → contract site cell cho Detail Log.
   * @param {Array<object>} fieldResults
   * @param {{ discoverMode?: boolean }} [opts]
   * @returns {{ state: string, value: string, pass: boolean, lines: Array<{text:string,status:string}> }}
   */
  function summarizeFieldResults(fieldResults, opts) {
    const discoverMode = !!(opts && opts.discoverMode);
    if (!fieldResults || !fieldResults.length) {
      return { state: 'skipped', value: '-', pass: false, lines: [] };
    }

    const displayable = fieldResults.filter(shouldDisplay);
    const lines = displayable.flatMap((f) => formatFieldLines(f, { discoverMode }));

    const scored = fieldResults.filter(
      (f) => !f.skipped && !f.noConfig && !f.missingOnWeb && !f.infoOnly && f.expected !== ''
    );
    const failed = scored.filter((f) => f.pass === false);
    const noConfig = fieldResults.filter((f) => f.noConfig && String(f.actual || '').trim());
    const missingWeb = fieldResults.filter((f) => f.missingOnWeb);

    if (!lines.length && !scored.length) {
      return { state: 'skipped', value: '-', pass: false, lines: [] };
    }

    const hasHighlight =
      failed.length > 0 ||
      noConfig.length > 0 ||
      missingWeb.length > 0 ||
      lines.some(
        (l) =>
          l.status === STATUS.MISMATCH ||
          l.status === STATUS.NO_CONFIG ||
          l.status === STATUS.MISSING_ON_WEB
      );

    if (!scored.length) {
      return {
        state: hasHighlight ? 'fail' : 'skipped',
        value: lines.map((l) => l.text).join('\n') || '-',
        pass: false,
        lines,
      };
    }

    const pass =
      failed.length === 0 && noConfig.length === 0 && missingWeb.length === 0;
    // discover: them noConfig/missing van fail (da tinh o tren)
    void discoverMode;
    return {
      state: pass ? 'pass' : 'fail',
      value: lines.map((l) => l.text).join('\n') || '-',
      pass,
      lines,
    };
  }

  /**
   * Parse suffix mark tu text (fallback khi site khong gui lines[]).
   * @returns {{ body: string, status: string }}
   */
  function parseLineStatus(line) {
    const s = String(line || '');
    if (/\s*⚠\s*missing on web\s*$/i.test(s) || /\s*⚠\s*missing on page\s*$/i.test(s)) {
      return {
        body: s.replace(/\s*⚠\s*missing on (?:web|page)\s*$/i, '').trim(),
        status: STATUS.MISSING_ON_WEB,
      };
    }
    if (/\s*⚠\s*no config\s*$/i.test(s)) {
      return {
        body: s.replace(/\s*⚠\s*no config\s*$/i, '').trim(),
        status: STATUS.NO_CONFIG,
      };
    }
    if (/\s*✗\s*$/.test(s)) {
      return { body: s.replace(/\s*✗\s*$/, '').trim(), status: STATUS.MISMATCH };
    }
    return { body: s, status: STATUS.OK };
  }

  function cssClassFor(status) {
    return CSS[status] || '';
  }

  return {
    STATUS,
    MARK,
    CSS,
    classifyField,
    shouldDisplay,
    markFor,
    formatFieldLines,
    summarizeFieldResults,
    parseLineStatus,
    cssClassFor,
  };
});
