/**
 * SINH TAI LIEU HUONG DAN NODE.
 *
 * Doc thang tu catalog.js (cung nguon voi app) roi render ra HTML tinh
 * -> them node moi vao catalog, chay lai lenh nay la tai lieu tu cap nhat,
 *    khong bao gio lech voi app.
 *
 * Chay: npm run docs:nodes
 * Ket qua:
 *   src/automation/docs/huong-dan-node.html   (mo trong app, full HTML)
 *   src/automation/docs/noi-dung.html         (chi phan noi dung, de dang len web)
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NODES, GROUPS } from '../src/nodes/catalog.js';
import { PORTS, IN_COLOR } from '../src/nodes/AutoNode.jsx';

// File chay that nam trong docs/.build, nen phai tro ve thu muc nguon theo cwd
// (npm script luon chay tu thu muc goc cua project).
const OUT_DIR = path.resolve(process.cwd(), 'src', 'automation', 'docs');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (Cmp, size = 18) => renderToStaticMarkup(<Cmp size={size} />);

const KIND_LABEL = {
  text: 'chu', number: 'so', textarea: 'doan van', select: 'chon san', bool: 'bat/tat',
};

const LOOP_TYPES = new Set(['logic.loop', 'logic.forEach', 'logic.while']);

/* ---------------------------------------------------------------- */
/* Cac phan viet tay: gioi thieu, cach dung, vi du                    */
/* ---------------------------------------------------------------- */

const INTRO = `
<section class="box">
  <h2>Bat dau nhanh</h2>
  <ol class="steps">
    <li><b>Mo man Automation</b> - bam nut <i>Automation</i> tren thanh cong cu cua app.</li>
    <li><b>Tao kich ban</b> - bam nut <i>Tao kich ban</i> o dashboard.</li>
    <li><b>Keo node</b> tu cot trai tha vao khung giua.</li>
    <li><b>Noi cac node</b> - keo tu cong ra ben phai cua node truoc sang dau vao ben trai cua node sau.</li>
    <li><b>Sua tham so</b> - bam vao node, cot phai hien form nhap.</li>
    <li><b>Luu</b> roi bam <i>Chay</i>. Log hien o khung duoi cung.</li>
  </ol>
  <p class="note">
    Kich ban gan nhu luon bat dau bang node <b>Mo profile</b> - node do mo profile Hidemium
    va noi Playwright vao, cac node sau moi co trinh duyet de lam viec.
  </p>
</section>

<section class="box">
  <h2>Nut tren node va tren day noi</h2>
  <ul class="bullets">
    <li><b>Nut Start</b> (hinh tam giac tren node) - chay kich ban bat dau tu chinh node do, tien cho viec thu tung doan.</li>
    <li><b>Nut Delete</b> (hinh thung rac tren node) - xoa node, cac day noi vao no bi xoa theo.</li>
    <li><b>Nut x do</b> giua day noi - xoa day noi do.</li>
    <li><b>Xoa canvas</b> tren thanh cong cu - xoa toan bo node dang co.</li>
  </ul>
</section>

<section class="box">
  <h2>Bien - lay ket qua cua node truoc dung cho node sau</h2>
  <p>
    Node co o <b>Luu vao bien</b> se cat ket qua lai. Muon dung lai o node khac thi viet
    <code>{{tenBien}}</code> trong o nhap - luc chay he thong tu thay bang gia tri that.
  </p>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Lay van ban</b> &middot; selector <code>.price</code> &middot; luu vao bien <code>gia</code></div>
    <div class="example__row"><span class="chip">2</span> <b>Ghi log</b> &middot; noi dung <code>Gia hien tai: {{gia}}</code></div>
  </div>
  <p class="note">
    Bien co san: <code>{{lastError}}</code> - thong bao loi cua node vua that bai (dung o nhanh Loi).
  </p>
</section>
`;

const RECIPES = `
<section class="box">
  <h2>Vai kich ban mau</h2>

  <h3>1. Dang nhap mot trang web</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Mo profile</b></div>
    <div class="example__row"><span class="chip">2</span> <b>Mo URL</b> &middot; <code>https://trangweb.com/login</code></div>
    <div class="example__row"><span class="chip">3</span> <b>Cho phan tu</b> &middot; <code>#username</code></div>
    <div class="example__row"><span class="chip">4</span> <b>Go phim</b> &middot; <code>#username</code> &middot; ten dang nhap</div>
    <div class="example__row"><span class="chip">5</span> <b>Go phim</b> &middot; <code>#password</code> &middot; mat khau</div>
    <div class="example__row"><span class="chip">6</span> <b>Click</b> &middot; <code>button[type=submit]</code></div>
    <div class="example__row"><span class="chip">7</span> <b>Cho chuyen trang</b></div>
    <div class="example__row"><span class="chip">8</span> <b>Kiem tra URL</b> &middot; chua <code>/dashboard</code></div>
  </div>

  <h3>2. Lap qua danh sach san pham va ghi ra file</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Mo profile</b> &rarr; <b>Mo URL</b></div>
    <div class="example__row"><span class="chip">2</span> <b>Lap theo phan tu</b> &middot; <code>.product-item</code> &middot; bien <code>item</code></div>
    <div class="example__row example__row--in"><span class="chip chip--loop">Moi vong</span> <b>Ghi file</b> &middot; noi dung <code>{{item}}</code></div>
    <div class="example__row example__row--in"><span class="chip chip--loop">&crarr;</span> noi nguoc ve dau vao <i>Quay lai vong lap</i> cua node lap</div>
    <div class="example__row"><span class="chip chip--done">Xong</span> <b>Ghi log</b> &middot; <code>Da lay xong</code></div>
  </div>

  <h3>3. Bo qua popup neu co</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Neu / Nguoc lai</b> &middot; kieu <code>selectorVisible</code> &middot; <code>.popup-close</code></div>
    <div class="example__row example__row--in"><span class="chip chip--true">Dung</span> <b>Click</b> &middot; <code>.popup-close</code> &rarr; node tiep theo</div>
    <div class="example__row example__row--in"><span class="chip chip--false">Sai</span> di thang toi node tiep theo</div>
  </div>

  <h3>4. Bat loi de kich ban khong chet giua chung</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Click</b> &middot; <code>#nut-co-the-khong-co</code></div>
    <div class="example__row example__row--in"><span class="chip chip--error">Loi</span> <b>Ghi log</b> &middot; <code>Bo qua: {{lastError}}</code> &rarr; chay tiep</div>
  </div>
</section>
`;

/* ---------------------------------------------------------------- */
/* Cac phan tu sinh tu catalog                                        */
/* ---------------------------------------------------------------- */

function portsSection() {
  const row = (key, when) => {
    const p = PORTS[key];
    return `<tr>
      <td><span class="port-dot" style="--c:${p.color}"></span> <b>${esc(p.label)}</b></td>
      <td><code>${esc(key)}</code></td>
      <td>${when}</td>
    </tr>`;
  };

  return `
<section class="box">
  <h2>Dau noi tren node</h2>
  <p>
    Ben trai node la <b>dau vao</b> (<span class="port-dot" style="--c:${IN_COLOR}"></span> mau xanh duong).
    Ben phai la cac <b>cong ra</b>, moi cong mot dong co mau rieng.
    Day noi mang mau cua cong ma no xuat phat, nhin la biet dang o nhanh nao.
  </p>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Cong</th><th>Ma</th><th>Khi nao di theo cong nay</th></tr></thead>
    <tbody>
      ${row('next', 'Node chay xong binh thuong. Node thuong chi co cong nay.')}
      ${row('true', 'Dieu kien cua node <i>Neu / Nguoc lai</i> dung.')}
      ${row('false', 'Dieu kien cua node <i>Neu / Nguoc lai</i> sai.')}
      ${row('loop', 'Di vao than vong lap - chay mot lan cho moi vong.')}
      ${row('done', 'Vong lap da chay het - di tiep phan sau.')}
      ${row('error', 'Node that bai. <b>Node nao cung co cong nay.</b>')}
    </tbody>
  </table></div>

  <h3>Cong Loi</h3>
  <p>
    Neu ban keo mot day tu cong <b>Loi</b>, khi node do that bai kich ban se di theo day do
    thay vi dung han, va thong bao loi duoc luu vao <code>{{lastError}}</code>.
    Khong noi gi vao cong Loi thi node that bai se dung ca kich ban.
  </p>

  <h3>Node lap</h3>
  <p>
    Ba node <b>Lap N lan</b>, <b>Lap theo phan tu</b>, <b>Lap khi con dung</b> co them mot dau vao
    <b>Quay lai vong lap</b> o canh duoi. Cach noi mot vong hoan chinh:
  </p>
  <ol class="steps">
    <li>Cong <b>Moi vong</b> &rarr; node dau tien cua than vong lap.</li>
    <li>Node cuoi cua than vong lap &rarr; dau vao <b>Quay lai vong lap</b> o day node lap.</li>
    <li>Cong <b>Xong</b> &rarr; phan chay tiep sau khi lap het.</li>
  </ol>
  <p class="note">
    Kich ban co gioi han 10.000 buoc. Noi sai thanh vong vo tan thi no tu dung va bao loi,
    khong lam treo app. Rieng <i>Lap khi con dung</i> con co them o <i>Gioi han vong lap</i>.
  </p>
</section>`;
}

function nodeCard(n) {
  const g = GROUPS[n.group];

  const fields = n.fields.length
    ? `<div class="node__fields tbl-wrap">
        <table class="tbl tbl--fields">
          <thead><tr><th>O nhap</th><th>Kieu</th><th>Mac dinh</th></tr></thead>
          <tbody>${n.fields.map((f) => `
            <tr>
              <td>${esc(f.label)}</td>
              <td><span class="kind">${esc(KIND_LABEL[f.kind] || 'chu')}</span>${
                f.options ? ' ' + f.options.map((o) => `<code>${esc(o)}</code>`).join(' ') : ''
              }</td>
              <td>${f.def !== undefined ? `<code>${esc(f.def)}</code>` : '<span class="dim">-</span>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : '<p class="node__none">Node nay khong can nhap gi.</p>';

  // Ve giong node that: moi cong mot dong, cham mau ben phai.
  const ports = [...(n.branches || ['next']), 'error']
    .map((k) => `
      <div class="node__port node__port--${k}" style="--c:${PORTS[k].color}">
        <span class="node__port-label">${esc(PORTS[k].label)}</span>
        <span class="port-dot"></span>
      </div>`)
    .join('');

  const loopBack = LOOP_TYPES.has(n.type)
    ? `<div class="node__port node__port--in" style="--c:${PORTS.loop.color}">
         <span class="node__port-label">&darr; dau vao: Quay lai vong lap</span>
         <span class="port-dot"></span>
       </div>`
    : '';

  return `
<article class="node" id="${esc(n.type)}" style="--c:${g.color}">
  <div class="node__bar"></div>
  <header class="node__head">
    <span class="node__icon">${icon(n.icon)}</span>
    <div class="node__name">
      <h3>${esc(n.label)}</h3>
      <span class="node__type">${esc(n.type)}</span>
    </div>
  </header>
  <p class="node__desc">${esc(n.desc)}</p>
  <div class="node__ports">${ports}${loopBack}</div>
  ${fields}
</article>`;
}

function groupSection(key) {
  const g = GROUPS[key];
  const items = NODES.filter((n) => n.group === key);
  return `
<section class="group" id="nhom-${key}">
  <h2 class="group__title" style="--c:${g.color}">
    <span class="group__dot"></span>${esc(g.label)}
    <span class="group__count">${items.length} node</span>
  </h2>
  <div class="group__grid">${items.map(nodeCard).join('')}</div>
</section>`;
}

/* ---------------------------------------------------------------- */

const CSS = fs.readFileSync(path.join(OUT_DIR, 'docs.css'), 'utf8');

const nav = Object.entries(GROUPS)
  .map(([k, g]) => `<a href="#nhom-${k}" style="--c:${g.color}"><span class="nav__dot"></span>${esc(g.label)}
    <span class="nav__n">${NODES.filter((n) => n.group === k).length}</span></a>`)
  .join('');

const CONTENT = `
<header class="top">
  <h1>Huong dan node Automation</h1>
  <p class="top__sub">
    Tai lieu su dung man flow keo tha cua Auto Test Core Hidemium &mdash;
    ${NODES.length} node, ${Object.keys(GROUPS).length} nhom.
  </p>
</header>

<nav class="nav">${nav}</nav>

${INTRO}
${portsSection()}
${RECIPES}

<h2 class="section-title">Danh sach day du ${NODES.length} node</h2>
<div class="search-wrap">
  <input id="q" class="search" type="text" placeholder="Go de tim node theo ten hoac ma..." />
  <span id="q-count" class="search__count"></span>
</div>

${Object.keys(GROUPS).map(groupSection).join('')}

<footer class="foot">
  Tai lieu nay duoc sinh tu <code>src/automation/src/nodes/catalog.js</code>.
  Them node moi thi chay lai <code>npm run docs:nodes</code> de cap nhat.
</footer>

<script>
  // Tim kiem tai cho: an node khong khop, an luon nhom rong.
  (function () {
    var q = document.getElementById('q');
    var count = document.getElementById('q-count');
    var nodes = [].slice.call(document.querySelectorAll('.node'));
    var groups = [].slice.call(document.querySelectorAll('.group'));
    if (!q) return;
    q.addEventListener('input', function () {
      var k = q.value.trim().toLowerCase();
      var shown = 0;
      nodes.forEach(function (n) {
        var hit = !k || n.textContent.toLowerCase().indexOf(k) >= 0;
        n.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        var any = g.querySelectorAll('.node:not([style*="none"])').length;
        g.style.display = any ? '' : 'none';
      });
      count.textContent = k ? shown + ' node khop' : '';
    });
  })();
</script>`;

// Ban day du de mo trong app
fs.writeFileSync(
  path.join(OUT_DIR, 'huong-dan-node.html'),
  `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Huong dan node Automation</title>
<style>${CSS}</style>
</head>
<body><main class="page">${CONTENT}</main></body>
</html>`,
  'utf8'
);

// Ban chi co noi dung, de dang len web (khong kem the html/head/body)
fs.writeFileSync(
  path.join(OUT_DIR, 'noi-dung.html'),
  `<title>Huong dan node Automation</title>\n<style>${CSS}</style>\n<main class="page">${CONTENT}</main>`,
  'utf8'
);

console.log(`Da sinh tai lieu cho ${NODES.length} node.`);
