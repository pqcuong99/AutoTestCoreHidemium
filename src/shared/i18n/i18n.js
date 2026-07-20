/**
 * i18n helper — dung chung main (require) + renderer (<script>).
 *
 * Renderer: window.I18n.t('btn.run')
 * Main:     const { t, setLocale } = require('../shared/i18n')
 */
(function (root) {
  const LOCALES = {
    vi: typeof I18N_VI !== 'undefined' ? I18N_VI : null,
    en: typeof I18N_EN !== 'undefined' ? I18N_EN : null,
  };

  // Khi require tu main, nap bang module.exports
  if (typeof module !== 'undefined' && module.exports) {
    try {
      LOCALES.vi = require('./vi');
      LOCALES.en = require('./en');
    } catch (_) {
      /* ignore */
    }
  }

  let locale = 'vi';
  const listeners = [];

  function getLocale() {
    return locale;
  }

  function setLocale(next) {
    const loc = next === 'en' ? 'en' : 'vi';
    if (loc === locale) return locale;
    locale = loc;
    listeners.forEach((fn) => {
      try {
        fn(locale);
      } catch (_) {
        /* ignore */
      }
    });
    return locale;
  }

  function onChange(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function t(key, vars) {
    const dict = LOCALES[locale] || LOCALES.vi || {};
    const fallback = LOCALES.vi || {};
    let s = dict[key] ?? fallback[key] ?? key;
    if (vars && typeof vars === 'object') {
      s = s.replace(/\{(\w+)\}/g, (_, k) =>
        vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''
      );
    }
    return s;
  }

  /** status key -> nhan hien thi */
  function statusLabel(status) {
    return t('status.' + (status || 'idle'));
  }

  /** Cap nhat DOM co data-i18n / data-i18n-title / data-i18n-placeholder / data-i18n-html */
  function applyDom(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope) return;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      // Neu co child .i18n-text thi chi doi text do (giu SVG)
      const slot = el.querySelector('.i18n-text');
      if (slot) slot.textContent = t(key);
      else el.textContent = t(key);
    });

    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });

    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });

    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'en' ? 'en' : 'vi';
    }
  }

  function timeLocale() {
    return locale === 'en' ? 'en-GB' : 'vi-VN';
  }

  const api = { t, setLocale, getLocale, onChange, applyDom, statusLabel, timeLocale, LOCALES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.I18n = api;
  root.t = t;
})(typeof window !== 'undefined' ? window : globalThis);
