/**
 * CATALOG NODE AUTOMATION.
 *
 * Moi node khai bao: type / label / icon / nhom / danh sach field cau hinh.
 * Phan THUC THI nam o main process: src/main/automation/actions.js
 * -> hai file phai dung CHUNG chuoi `type`. Them node moi thi them ca hai noi.
 *
 * field.kind: 'text' | 'number' | 'textarea' | 'select' | 'bool'
 */
import {
  Play, Power, Globe, RotateCw, ArrowLeft, ArrowRight, Monitor,
  PlusSquare, XSquare, Layers,
  MousePointerClick, MousePointer2, Copy, Keyboard, Type, CornerDownLeft,
  Hand, MoveVertical, ListChecks, CheckSquare, Upload, Move, Focus, Eraser,
  Timer, Search, Navigation, TextSearch, Loader,
  FileText, Tag, TextCursorInput, Link2, Heading, Hash, Camera, Cookie,
  GitBranch, Repeat, ListOrdered, RefreshCw, SkipForward, OctagonX,
  Variable, Dices, FileInput, FileOutput, Terminal,
  ShieldCheck, ShieldAlert, ShieldQuestion, Code2,
} from 'lucide-react';

/** Nhom node -> mau sac hien thi tren canvas va tren palette. */
export const GROUPS = {
  browser: { label: 'Browser', color: '#3b82f6' },
  action: { label: 'Tuong tac', color: '#8b5cf6' },
  wait: { label: 'Cho', color: '#f59e0b' },
  extract: { label: 'Lay du lieu', color: '#10b981' },
  logic: { label: 'Logic', color: '#f43f5e' },
  data: { label: 'Du lieu', color: '#06b6d4' },
  assert: { label: 'Kiem tra', color: '#f97316' },
  script: { label: 'Script', color: '#64748b' },
};

/** Field dung lai nhieu lan. */
const selector = { key: 'selector', label: 'Selector (CSS / text=)', kind: 'text', placeholder: '#login-btn' };
const timeout = { key: 'timeout', label: 'Timeout (ms)', kind: 'number', def: 30000 };
const saveTo = { key: 'saveTo', label: 'Luu vao bien', kind: 'text', placeholder: 'myVar' };

export const NODES = [
  // ---------------- BROWSER ----------------
  {
    type: 'browser.open', group: 'browser', icon: Play, label: 'Mo profile',
    desc: 'Mo profile Hidemium qua Local API roi noi Playwright vao (CDP)',
    fields: [
      { key: 'uuid', label: 'UUID profile (bo trong = lay tu danh sach chay)', kind: 'text' },
      timeout,
    ],
  },
  {
    type: 'browser.close', group: 'browser', icon: Power, label: 'Dong profile',
    desc: 'Dong profile Hidemium qua Local API', fields: [],
  },
  {
    type: 'browser.goto', group: 'browser', icon: Globe, label: 'Mo URL',
    desc: 'Dieu huong tab hien tai toi URL',
    fields: [
      { key: 'url', label: 'URL', kind: 'text', placeholder: 'https://example.com' },
      { key: 'waitUntil', label: 'Cho den khi', kind: 'select', options: ['load', 'domcontentloaded', 'networkidle'], def: 'load' },
      timeout,
    ],
  },
  { type: 'browser.reload', group: 'browser', icon: RotateCw, label: 'Tai lai trang', desc: 'Reload tab hien tai', fields: [timeout] },
  { type: 'browser.back', group: 'browser', icon: ArrowLeft, label: 'Quay lai', desc: 'Lich su: lui 1 buoc', fields: [] },
  { type: 'browser.forward', group: 'browser', icon: ArrowRight, label: 'Tien toi', desc: 'Lich su: tien 1 buoc', fields: [] },
  {
    type: 'browser.newTab', group: 'browser', icon: PlusSquare, label: 'Tab moi',
    desc: 'Mo tab moi va chuyen sang tab do',
    fields: [{ key: 'url', label: 'URL (tuy chon)', kind: 'text' }],
  },
  { type: 'browser.closeTab', group: 'browser', icon: XSquare, label: 'Dong tab', desc: 'Dong tab dang chon', fields: [] },
  {
    type: 'browser.switchTab', group: 'browser', icon: Layers, label: 'Chuyen tab',
    desc: 'Chuyen sang tab theo chi so (0 la tab dau)',
    fields: [{ key: 'index', label: 'Chi so tab', kind: 'number', def: 0 }],
  },
  {
    type: 'browser.setViewport', group: 'browser', icon: Monitor, label: 'Doi kich thuoc',
    desc: 'Dat lai kich thuoc cua so trinh duyet',
    fields: [
      { key: 'width', label: 'Rong', kind: 'number', def: 1280 },
      { key: 'height', label: 'Cao', kind: 'number', def: 800 },
    ],
  },

  // ---------------- TUONG TAC ----------------
  {
    type: 'act.click', group: 'action', icon: MousePointerClick, label: 'Click',
    desc: 'Click chuot trai vao phan tu', fields: [selector, timeout],
  },
  { type: 'act.doubleClick', group: 'action', icon: Copy, label: 'Double click', desc: 'Click dup', fields: [selector, timeout] },
  { type: 'act.rightClick', group: 'action', icon: MousePointer2, label: 'Click phai', desc: 'Mo menu chuot phai', fields: [selector, timeout] },
  {
    type: 'act.type', group: 'action', icon: Keyboard, label: 'Go phim',
    desc: 'Go tung ky tu (co do tre) - giong nguoi that',
    fields: [
      selector,
      { key: 'text', label: 'Noi dung', kind: 'textarea' },
      { key: 'delay', label: 'Tre moi ky tu (ms)', kind: 'number', def: 50 },
      timeout,
    ],
  },
  {
    type: 'act.fill', group: 'action', icon: Type, label: 'Dien nhanh',
    desc: 'Dien thang gia tri vao o input (khong go tung phim)',
    fields: [selector, { key: 'text', label: 'Noi dung', kind: 'textarea' }, timeout],
  },
  {
    type: 'act.press', group: 'action', icon: CornerDownLeft, label: 'Nhan phim',
    desc: 'Nhan phim don hoac to hop (Enter, Control+A...)',
    fields: [selector, { key: 'key', label: 'Phim', kind: 'text', placeholder: 'Enter', def: 'Enter' }, timeout],
  },
  { type: 'act.hover', group: 'action', icon: Hand, label: 'Hover', desc: 'Di chuot len phan tu', fields: [selector, timeout] },
  {
    type: 'act.scroll', group: 'action', icon: MoveVertical, label: 'Cuon trang',
    desc: 'Cuon theo so pixel, hoac cuon toi phan tu neu co selector',
    fields: [
      { key: 'selector', label: 'Selector (bo trong = cuon ca trang)', kind: 'text' },
      { key: 'y', label: 'So pixel doc', kind: 'number', def: 500 },
    ],
  },
  {
    type: 'act.select', group: 'action', icon: ListChecks, label: 'Chon dropdown',
    desc: 'Chon option trong the <select>',
    fields: [selector, { key: 'value', label: 'Gia tri option', kind: 'text' }, timeout],
  },
  {
    type: 'act.check', group: 'action', icon: CheckSquare, label: 'Tick checkbox',
    desc: 'Tick hoac bo tick checkbox / radio',
    fields: [selector, { key: 'checked', label: 'Tick vao', kind: 'bool', def: true }, timeout],
  },
  {
    type: 'act.upload', group: 'action', icon: Upload, label: 'Upload file',
    desc: 'Chon file cho o input type=file',
    fields: [selector, { key: 'filePath', label: 'Duong dan file', kind: 'text' }, timeout],
  },
  {
    type: 'act.dragDrop', group: 'action', icon: Move, label: 'Keo tha',
    desc: 'Keo phan tu nguon tha vao phan tu dich',
    fields: [
      { key: 'selector', label: 'Selector nguon', kind: 'text' },
      { key: 'target', label: 'Selector dich', kind: 'text' },
      timeout,
    ],
  },
  { type: 'act.focus', group: 'action', icon: Focus, label: 'Focus', desc: 'Dat con tro vao phan tu', fields: [selector, timeout] },
  { type: 'act.clear', group: 'action', icon: Eraser, label: 'Xoa noi dung', desc: 'Xoa sach o input', fields: [selector, timeout] },

  // ---------------- CHO ----------------
  {
    type: 'wait.time', group: 'wait', icon: Timer, label: 'Cho (giay)',
    desc: 'Dung lai mot khoang thoi gian co dinh',
    fields: [{ key: 'ms', label: 'Thoi gian (ms)', kind: 'number', def: 1000 }],
  },
  {
    type: 'wait.selector', group: 'wait', icon: Search, label: 'Cho phan tu',
    desc: 'Cho den khi phan tu xuat hien / bien mat',
    fields: [
      selector,
      { key: 'state', label: 'Trang thai', kind: 'select', options: ['visible', 'hidden', 'attached', 'detached'], def: 'visible' },
      timeout,
    ],
  },
  { type: 'wait.navigation', group: 'wait', icon: Navigation, label: 'Cho chuyen trang', desc: 'Cho dieu huong hoan tat', fields: [timeout] },
  {
    type: 'wait.text', group: 'wait', icon: TextSearch, label: 'Cho van ban',
    desc: 'Cho den khi trang chua doan van ban',
    fields: [{ key: 'text', label: 'Van ban', kind: 'text' }, timeout],
  },
  {
    type: 'wait.load', group: 'wait', icon: Loader, label: 'Cho tai xong',
    desc: 'Cho trang o trang thai load / networkidle',
    fields: [
      { key: 'state', label: 'Trang thai', kind: 'select', options: ['load', 'domcontentloaded', 'networkidle'], def: 'networkidle' },
      timeout,
    ],
  },

  // ---------------- LAY DU LIEU ----------------
  { type: 'get.text', group: 'extract', icon: FileText, label: 'Lay van ban', desc: 'Doc textContent cua phan tu', fields: [selector, saveTo, timeout] },
  {
    type: 'get.attribute', group: 'extract', icon: Tag, label: 'Lay thuoc tinh',
    desc: 'Doc gia tri thuoc tinh (href, src, class...)',
    fields: [selector, { key: 'attr', label: 'Ten thuoc tinh', kind: 'text', placeholder: 'href' }, saveTo, timeout],
  },
  { type: 'get.value', group: 'extract', icon: TextCursorInput, label: 'Lay gia tri input', desc: 'Doc value cua o input', fields: [selector, saveTo, timeout] },
  { type: 'get.url', group: 'extract', icon: Link2, label: 'Lay URL', desc: 'URL cua tab hien tai', fields: [saveTo] },
  { type: 'get.title', group: 'extract', icon: Heading, label: 'Lay tieu de', desc: 'Tieu de trang', fields: [saveTo] },
  { type: 'get.count', group: 'extract', icon: Hash, label: 'Dem phan tu', desc: 'Dem so phan tu khop selector', fields: [selector, saveTo] },
  {
    type: 'get.screenshot', group: 'extract', icon: Camera, label: 'Chup man hinh',
    desc: 'Luu anh man hinh ra file',
    fields: [
      { key: 'filePath', label: 'Duong dan luu (.png)', kind: 'text' },
      { key: 'fullPage', label: 'Chup ca trang', kind: 'bool', def: false },
    ],
  },
  { type: 'get.cookies', group: 'extract', icon: Cookie, label: 'Lay cookie', desc: 'Doc toan bo cookie cua context', fields: [saveTo] },

  // ---------------- LOGIC ----------------
  {
    type: 'logic.if', group: 'logic', icon: GitBranch, label: 'Neu / Nguoc lai',
    desc: 'Re nhanh theo dieu kien. Co 2 cong ra: Dung va Sai',
    branches: ['true', 'false'],
    fields: [
      {
        key: 'mode', label: 'Kieu dieu kien', kind: 'select',
        options: ['selectorExists', 'selectorVisible', 'textContains', 'varEquals', 'expression'], def: 'selectorExists',
      },
      { key: 'selector', label: 'Selector / Bien', kind: 'text' },
      { key: 'value', label: 'Gia tri so sanh', kind: 'text' },
      timeout,
    ],
  },
  {
    type: 'logic.loop', group: 'logic', icon: Repeat, label: 'Lap N lan',
    desc: 'Chay nhanh "Moi vong" dung N lan roi di tiep',
    branches: ['loop', 'done'],
    fields: [{ key: 'times', label: 'So lan lap', kind: 'number', def: 3 }],
  },
  {
    type: 'logic.forEach', group: 'logic', icon: ListOrdered, label: 'Lap theo phan tu',
    desc: 'Lap qua tung phan tu khop selector',
    branches: ['loop', 'done'],
    fields: [selector, { key: 'itemVar', label: 'Bien phan tu', kind: 'text', def: 'item' }],
  },
  {
    type: 'logic.while', group: 'logic', icon: RefreshCw, label: 'Lap khi con dung',
    desc: 'Lap chung nao dieu kien con dung (co gioi han vong)',
    branches: ['loop', 'done'],
    fields: [
      { key: 'mode', label: 'Kieu dieu kien', kind: 'select', options: ['selectorExists', 'selectorVisible', 'varEquals'], def: 'selectorExists' },
      { key: 'selector', label: 'Selector / Bien', kind: 'text' },
      { key: 'value', label: 'Gia tri so sanh', kind: 'text' },
      { key: 'maxLoops', label: 'Gioi han vong lap', kind: 'number', def: 50 },
    ],
  },
  { type: 'logic.break', group: 'logic', icon: SkipForward, label: 'Thoat vong lap', desc: 'Nhay ra khoi vong lap gan nhat', fields: [] },
  {
    type: 'logic.stop', group: 'logic', icon: OctagonX, label: 'Dung kich ban',
    desc: 'Ket thuc toan bo kich ban ngay lap tuc',
    fields: [{ key: 'reason', label: 'Ly do', kind: 'text' }],
  },

  // ---------------- DU LIEU ----------------
  {
    type: 'data.setVar', group: 'data', icon: Variable, label: 'Gan bien',
    desc: 'Tao / doi gia tri mot bien. Dung {{ten}} de chen vao node khac',
    fields: [{ key: 'name', label: 'Ten bien', kind: 'text' }, { key: 'value', label: 'Gia tri', kind: 'textarea' }],
  },
  {
    type: 'data.random', group: 'data', icon: Dices, label: 'Ngau nhien',
    desc: 'Sinh so / chuoi ngau nhien',
    fields: [
      { key: 'kind', label: 'Kieu', kind: 'select', options: ['number', 'string', 'email'], def: 'number' },
      { key: 'min', label: 'Nho nhat / Do dai', kind: 'number', def: 1 },
      { key: 'max', label: 'Lon nhat', kind: 'number', def: 100 },
      saveTo,
    ],
  },
  {
    type: 'data.readFile', group: 'data', icon: FileInput, label: 'Doc file',
    desc: 'Doc noi dung file text vao bien',
    fields: [{ key: 'filePath', label: 'Duong dan file', kind: 'text' }, saveTo],
  },
  {
    type: 'data.writeFile', group: 'data', icon: FileOutput, label: 'Ghi file',
    desc: 'Ghi / noi them noi dung vao file',
    fields: [
      { key: 'filePath', label: 'Duong dan file', kind: 'text' },
      { key: 'content', label: 'Noi dung', kind: 'textarea' },
      { key: 'append', label: 'Noi them vao cuoi', kind: 'bool', def: true },
    ],
  },
  {
    type: 'data.log', group: 'data', icon: Terminal, label: 'Ghi log',
    desc: 'In mot dong ra khung log khi chay',
    fields: [{ key: 'message', label: 'Noi dung', kind: 'textarea' }],
  },

  // ---------------- KIEM TRA ----------------
  {
    type: 'assert.exists', group: 'assert', icon: ShieldCheck, label: 'Kiem tra ton tai',
    desc: 'That bai neu phan tu khong xuat hien', fields: [selector, timeout],
  },
  {
    type: 'assert.text', group: 'assert', icon: ShieldAlert, label: 'Kiem tra van ban',
    desc: 'That bai neu van ban khong khop',
    fields: [selector, { key: 'value', label: 'Van ban mong doi', kind: 'text' }, timeout],
  },
  {
    type: 'assert.url', group: 'assert', icon: ShieldQuestion, label: 'Kiem tra URL',
    desc: 'That bai neu URL khong chua doan nay',
    fields: [{ key: 'value', label: 'URL mong doi (chua)', kind: 'text' }],
  },

  // ---------------- SCRIPT ----------------
  {
    type: 'script.js', group: 'script', icon: Code2, label: 'Chay JavaScript',
    desc: 'Chay doan JS trong trang, ket qua tra ve luu vao bien',
    fields: [{ key: 'code', label: 'Ma JavaScript', kind: 'textarea', placeholder: 'return document.title;' }, saveTo],
  },
];

/** Tra cuu nhanh theo type. */
export const NODE_MAP = Object.fromEntries(NODES.map((n) => [n.type, n]));

/** Gia tri mac dinh cua mot node khi vua keo vao canvas. */
export function defaultParams(type) {
  const def = NODE_MAP[type];
  if (!def) return {};
  const out = {};
  for (const f of def.fields) if (f.def !== undefined) out[f.key] = f.def;
  return out;
}

/** Gom node theo nhom de ve palette. */
export function groupedNodes() {
  return Object.entries(GROUPS).map(([key, meta]) => ({
    key,
    ...meta,
    items: NODES.filter((n) => n.group === key),
  }));
}
