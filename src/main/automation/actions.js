/**
 * THUC THI TUNG NODE AUTOMATION bang Playwright.
 *
 * Moi ham nhan (ctx, params) va co the:
 *   - throw Error            -> node that bai, kich ban dung (tru khi bat o executor)
 *   - return { branch:'x' }  -> bao cho executor di theo cong ra nao (node re nhanh)
 *   - return undefined       -> chay tiep cong ra mac dinh
 *
 * Chuoi `type` phai trung voi src/automation/src/nodes/catalog.js.
 *
 * Trinh duyet: KHONG tu mo Chromium. Node "browser.open" goi Local API cua Hidemium
 * de mo profile that, roi noi Playwright vao qua CDP -> giu nguyen fingerprint.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { openProfile, closeProfile } = require('../hidemiumApi');

/** Thay {{ten}} bang gia tri bien. Bien chua co -> giu nguyen de de phat hien sai. */
function interpolate(value, vars) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) =>
    vars[key] !== undefined ? String(vars[key]) : m
  );
}

/** Ap interpolate cho toan bo params truoc khi chay node. */
function resolveParams(params = {}, vars = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) out[k] = interpolate(v, vars);
  return out;
}

const num = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

/** Bat buoc phai co page - node tuong tac nao cung can. */
function needPage(ctx) {
  if (!ctx.page) throw new Error('Chua co trinh duyet. Them node "Mo profile" o dau kich ban.');
  return ctx.page;
}

function needSelector(p) {
  if (!p.selector) throw new Error('Node nay can Selector.');
  return p.selector;
}

/** Sleep huy duoc khi bam Dung. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new Error('aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Ghi ket qua vao bien neu node co khai bao saveTo. */
function store(ctx, p, value) {
  if (p.saveTo) {
    ctx.vars[p.saveTo] = value;
    ctx.log(`${p.saveTo} = ${JSON.stringify(value)?.slice(0, 160)}`);
  }
  return value;
}

const ACTIONS = {
  // ---------------- BROWSER ----------------
  async 'browser.open'(ctx, p) {
    const uuid = p.uuid || ctx.options.uuid;
    if (!uuid) throw new Error('Chua co UUID profile. Nhap vao node hoac chon profile o man chinh.');

    ctx.log(`Mo profile ${uuid}...`);
    const res = await openProfile(uuid, { baseUrl: ctx.options.apiBase, signal: ctx.signal });
    if (!res.ok) throw new Error('Mo profile that bai: ' + res.error);

    ctx.state.uuid = uuid;
    ctx.state.opened = true;

    // Hidemium tra ve web_socket (CDP) va/hoac remote_port.
    const endpoint = res.data.web_socket || `http://127.0.0.1:${res.data.remote_port}`;
    ctx.log(`Noi Playwright qua CDP: ${endpoint}`);

    const browser = await chromium.connectOverCDP(endpoint, { timeout: num(p.timeout, 30000) });
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());

    ctx.browser = browser;
    ctx.context = context;
    ctx.setPage(page);
    ctx.log('Da noi trinh duyet.', 'ok');
  },

  async 'browser.close'(ctx) {
    // Ngat Playwright truoc, roi bao Hidemium dong profile.
    if (ctx.browser) {
      await ctx.browser.close().catch(() => {});
      ctx.browser = null;
    }
    if (ctx.state.uuid && ctx.state.opened) {
      const r = await closeProfile(ctx.state.uuid, { baseUrl: ctx.options.apiBase });
      ctx.state.opened = false;
      ctx.log(r.ok ? 'Da dong profile.' : 'Dong profile that bai: ' + r.error, r.ok ? 'ok' : 'err');
    }
    ctx.setPage(null);
  },

  async 'browser.goto'(ctx, p) {
    if (!p.url) throw new Error('Chua nhap URL.');
    const url = /^https?:\/\//i.test(p.url) ? p.url : 'https://' + p.url;
    await needPage(ctx).goto(url, {
      waitUntil: p.waitUntil || 'load',
      timeout: num(p.timeout, 30000),
    });
    ctx.log('Da mo ' + url, 'ok');
  },

  async 'browser.reload'(ctx, p) {
    await needPage(ctx).reload({ timeout: num(p.timeout, 30000) });
  },

  async 'browser.back'(ctx) { await needPage(ctx).goBack(); },
  async 'browser.forward'(ctx) { await needPage(ctx).goForward(); },

  async 'browser.newTab'(ctx, p) {
    if (!ctx.context) throw new Error('Chua co trinh duyet.');
    const page = await ctx.context.newPage();
    if (p.url) await page.goto(interpolate(p.url, ctx.vars), { waitUntil: 'load' });
    ctx.setPage(page);
    ctx.log('Da mo tab moi.', 'ok');
  },

  async 'browser.closeTab'(ctx) {
    const page = needPage(ctx);
    await page.close();
    // Chuyen ve tab con lai de cac node sau van chay duoc.
    const rest = ctx.context?.pages() || [];
    ctx.setPage(rest[rest.length - 1] || null);
  },

  async 'browser.switchTab'(ctx, p) {
    const pages = ctx.context?.pages() || [];
    const i = num(p.index, 0);
    if (!pages[i]) throw new Error(`Khong co tab thu ${i} (dang co ${pages.length} tab).`);
    await pages[i].bringToFront();
    ctx.setPage(pages[i]);
  },

  async 'browser.setViewport'(ctx, p) {
    await needPage(ctx).setViewportSize({
      width: num(p.width, 1280),
      height: num(p.height, 800),
    });
  },

  // ---------------- TUONG TAC ----------------
  async 'act.click'(ctx, p) {
    await needPage(ctx).click(needSelector(p), { timeout: num(p.timeout, 30000) });
  },
  async 'act.doubleClick'(ctx, p) {
    await needPage(ctx).dblclick(needSelector(p), { timeout: num(p.timeout, 30000) });
  },
  async 'act.rightClick'(ctx, p) {
    await needPage(ctx).click(needSelector(p), { button: 'right', timeout: num(p.timeout, 30000) });
  },
  async 'act.type'(ctx, p) {
    await needPage(ctx).type(needSelector(p), String(p.text ?? ''), {
      delay: num(p.delay, 50),
      timeout: num(p.timeout, 30000),
    });
  },
  async 'act.fill'(ctx, p) {
    await needPage(ctx).fill(needSelector(p), String(p.text ?? ''), { timeout: num(p.timeout, 30000) });
  },
  async 'act.press'(ctx, p) {
    const page = needPage(ctx);
    const key = p.key || 'Enter';
    if (p.selector) await page.press(p.selector, key, { timeout: num(p.timeout, 30000) });
    else await page.keyboard.press(key);
  },
  async 'act.hover'(ctx, p) {
    await needPage(ctx).hover(needSelector(p), { timeout: num(p.timeout, 30000) });
  },
  async 'act.scroll'(ctx, p) {
    const page = needPage(ctx);
    if (p.selector) {
      await page.locator(p.selector).first().scrollIntoViewIfNeeded({ timeout: num(p.timeout, 30000) });
    } else {
      await page.mouse.wheel(0, num(p.y, 500));
    }
  },
  async 'act.select'(ctx, p) {
    await needPage(ctx).selectOption(needSelector(p), String(p.value ?? ''), { timeout: num(p.timeout, 30000) });
  },
  async 'act.check'(ctx, p) {
    const page = needPage(ctx);
    const sel = needSelector(p);
    const opts = { timeout: num(p.timeout, 30000) };
    if (p.checked === false) await page.uncheck(sel, opts);
    else await page.check(sel, opts);
  },
  async 'act.upload'(ctx, p) {
    if (!p.filePath) throw new Error('Chua chon duong dan file.');
    await needPage(ctx).setInputFiles(needSelector(p), p.filePath, { timeout: num(p.timeout, 30000) });
  },
  async 'act.dragDrop'(ctx, p) {
    if (!p.target) throw new Error('Chua nhap selector dich.');
    await needPage(ctx).dragAndDrop(needSelector(p), p.target, { timeout: num(p.timeout, 30000) });
  },
  async 'act.focus'(ctx, p) {
    await needPage(ctx).focus(needSelector(p), { timeout: num(p.timeout, 30000) });
  },
  async 'act.clear'(ctx, p) {
    await needPage(ctx).fill(needSelector(p), '', { timeout: num(p.timeout, 30000) });
  },

  // ---------------- CHO ----------------
  async 'wait.time'(ctx, p) {
    const ms = num(p.ms, 1000);
    ctx.log(`Cho ${ms}ms...`);
    await sleep(ms, ctx.signal);
  },
  async 'wait.selector'(ctx, p) {
    await needPage(ctx).waitForSelector(needSelector(p), {
      state: p.state || 'visible',
      timeout: num(p.timeout, 30000),
    });
  },
  async 'wait.navigation'(ctx, p) {
    await needPage(ctx).waitForNavigation({ timeout: num(p.timeout, 30000) }).catch(() => {});
  },
  async 'wait.text'(ctx, p) {
    if (!p.text) throw new Error('Chua nhap van ban can cho.');
    await needPage(ctx)
      .locator(`text=${p.text}`)
      .first()
      .waitFor({ state: 'visible', timeout: num(p.timeout, 30000) });
  },
  async 'wait.load'(ctx, p) {
    await needPage(ctx).waitForLoadState(p.state || 'networkidle', { timeout: num(p.timeout, 30000) });
  },

  // ---------------- LAY DU LIEU ----------------
  async 'get.text'(ctx, p) {
    const v = await needPage(ctx).locator(needSelector(p)).first()
      .innerText({ timeout: num(p.timeout, 30000) });
    return void store(ctx, p, v);
  },
  async 'get.attribute'(ctx, p) {
    if (!p.attr) throw new Error('Chua nhap ten thuoc tinh.');
    const v = await needPage(ctx).locator(needSelector(p)).first()
      .getAttribute(p.attr, { timeout: num(p.timeout, 30000) });
    return void store(ctx, p, v);
  },
  async 'get.value'(ctx, p) {
    const v = await needPage(ctx).locator(needSelector(p)).first()
      .inputValue({ timeout: num(p.timeout, 30000) });
    return void store(ctx, p, v);
  },
  async 'get.url'(ctx, p) { return void store(ctx, p, needPage(ctx).url()); },
  async 'get.title'(ctx, p) { return void store(ctx, p, await needPage(ctx).title()); },
  async 'get.count'(ctx, p) {
    const n = await needPage(ctx).locator(needSelector(p)).count();
    return void store(ctx, p, n);
  },
  async 'get.screenshot'(ctx, p) {
    if (!p.filePath) throw new Error('Chua nhap duong dan luu anh.');
    fs.mkdirSync(path.dirname(p.filePath), { recursive: true });
    await needPage(ctx).screenshot({ path: p.filePath, fullPage: Boolean(p.fullPage) });
    ctx.log('Da luu anh: ' + p.filePath, 'ok');
  },
  async 'get.cookies'(ctx, p) {
    if (!ctx.context) throw new Error('Chua co trinh duyet.');
    return void store(ctx, p, await ctx.context.cookies());
  },

  // ---------------- LOGIC (re nhanh) ----------------
  // logic.if / loop / forEach / while / break / stop do executor xu ly
  // vi chung can biet cau truc do thi, khong chi rieng page.

  // ---------------- DU LIEU ----------------
  async 'data.setVar'(ctx, p) {
    if (!p.name) throw new Error('Chua nhap ten bien.');
    ctx.vars[p.name] = p.value ?? '';
    ctx.log(`${p.name} = ${String(p.value).slice(0, 160)}`);
  },
  async 'data.random'(ctx, p) {
    const min = num(p.min, 1);
    const max = num(p.max, 100);
    let v;
    if (p.kind === 'string' || p.kind === 'email') {
      const len = Math.max(1, min);
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
      v = p.kind === 'email' ? `${s}@gmail.com` : s;
    } else {
      v = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return void store(ctx, p, v);
  },
  async 'data.readFile'(ctx, p) {
    if (!p.filePath) throw new Error('Chua nhap duong dan file.');
    return void store(ctx, p, fs.readFileSync(p.filePath, 'utf8'));
  },
  async 'data.writeFile'(ctx, p) {
    if (!p.filePath) throw new Error('Chua nhap duong dan file.');
    fs.mkdirSync(path.dirname(p.filePath), { recursive: true });
    const content = String(p.content ?? '');
    if (p.append === false) fs.writeFileSync(p.filePath, content, 'utf8');
    else fs.appendFileSync(p.filePath, content + '\n', 'utf8');
    ctx.log('Da ghi file: ' + p.filePath, 'ok');
  },
  async 'data.log'(ctx, p) {
    ctx.log(String(p.message ?? ''), 'info');
  },

  // ---------------- KIEM TRA ----------------
  async 'assert.exists'(ctx, p) {
    const sel = needSelector(p);
    try {
      await needPage(ctx).waitForSelector(sel, { state: 'attached', timeout: num(p.timeout, 10000) });
    } catch {
      throw new Error(`Kiem tra that bai: khong tim thay "${sel}".`);
    }
    ctx.log('OK: ton tai ' + sel, 'ok');
  },
  async 'assert.text'(ctx, p) {
    const actual = await needPage(ctx).locator(needSelector(p)).first()
      .innerText({ timeout: num(p.timeout, 10000) });
    if (!String(actual).includes(String(p.value ?? ''))) {
      throw new Error(`Kiem tra that bai: mong doi "${p.value}", thuc te "${actual}".`);
    }
    ctx.log('OK: van ban khop.', 'ok');
  },
  async 'assert.url'(ctx, p) {
    const url = needPage(ctx).url();
    if (!url.includes(String(p.value ?? ''))) {
      throw new Error(`Kiem tra that bai: URL "${url}" khong chua "${p.value}".`);
    }
    ctx.log('OK: URL khop.', 'ok');
  },

  // ---------------- SCRIPT ----------------
  async 'script.js'(ctx, p) {
    if (!p.code) throw new Error('Chua nhap ma JavaScript.');
    // Chay trong trang (khong phai trong Node) -> khong dung toi may nguoi dung.
    const v = await needPage(ctx).evaluate(`(async () => { ${p.code} })()`);
    return void store(ctx, p, v);
  },
};

module.exports = { ACTIONS, resolveParams, interpolate, sleep, num };
