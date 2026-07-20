# AutoTestCoreHidemium

Auto test core Hidemium - chon file Excel, chay check fingerprint theo profile.

## Yeu cau

- Node.js
- npm

## Cai dat

```bash
npm install
```

## Chay ung dung

```bash
npm start
```

Chay che do dev:

```bash
npm run dev
```

## Cau truc thu muc

```text
src/
  main/       Main process cua Electron
  renderer/   Giao dien va logic renderer
sample/       File mau
```

## Git

Them remote GitHub:

```bash
git remote add origin https://github.com/pqcuong99/AutoTestCoreHidemium.git
```

Push len GitHub:

```bash
git add .
git commit -m "Add project files"
git branch -M main
git push -u origin main
```

## Man Automation (React Flow + Playwright)

Bam nut **Automation** tren thanh cong cu -> hien dashboard kich ban -> **Tao kich ban** -> man flow keo tha.

Ca app chi dung **MOT cua so** duy nhat: man Automation la mot lop phu ngay trong cua so
chinh, khong mo cua so Windows moi. Bam **Dong** o dashboard de tro ve man profile.

### Build

Man Automation la app React rieng, phai build mot lan truoc khi dung:

```bash
npm run build:automation   # build ra src/automation/dist
npm start
```

Sua giao dien man flow thi build lai (`npm run build:automation`) roi khoi dong lai app.

Ky thuat: build ra dang IIFE (`dist/automation.js` + `dist/automation.css`) de
`src/renderer/index.html` nap duoc bang the `<script>` thuong. Toan bo CSS cua man
Automation duoc boc trong `.automation-root` - app chinh cung co `.btn` / `.badge` /
`.search` / `.field`, khong boc lai thi hai ben de len nhau.

### Cach dung man flow

- Keo node tu cot trai tha vao canvas.
- Noi cham phai cua node truoc sang cham trai cua node sau -> tao quy trinh chay lan luot.
- Di chuot vao node hien 2 nut: **Start** (chay tu node do) va **Delete** (xoa node).
- Di chuot vao day noi hien nut **x** de xoa day.
- Chon node -> cot phai sua tham so.
- Dung `{{tenBien}}` trong o nhap de chen gia tri da luu bang node "Gan bien" / "Lay van ban"...

### Cong ra cua node

Moi cong ra la mot dong rieng ben duoi node, co mau va nhan riêng:

| Cong | Mau | Y nghia |
|---|---|---|
| Tiep theo | xanh la | node thuong chay xong thi di tiep |
| Dung / Sai | xanh la / vang | hai nhanh cua node `Neu / Nguoc lai` |
| Moi vong / Xong | tim / xanh duong | than vong lap / chay tiep khi lap xong |
| Loi | do (net dut) | **moi node deu co** - node loi thi di theo day nay thay vi dung ca kich ban |

Day noi mang mau cua cong ma no xuat phat, nen nhin la biet dang o nhanh nao.

**Nhanh Loi**: neu node co day noi tu cong *Loi*, khi node do that bai kich ban se di
theo day do va ghi thong bao loi vao bien `{{lastError}}`. Khong noi gi vao cong *Loi*
thi node loi se dung ca kich ban nhu truoc.

**Node lap** co them dau vao `Quay lai vong lap` o canh duoi: noi node cuoi cua than
vong lap vao day de khep vong. Cong **Moi vong** di vao than vong, cong **Xong** chay tiep.

### Trinh duyet

Node **Mo profile** goi Local API cua Hidemium (`/openProfile`) roi noi Playwright vao qua CDP
(`chromium.connectOverCDP`) -> giu nguyen fingerprint cua profile. Khong tu mo Chromium rieng,
nen chi can `playwright-core`, khong phai tai browser ve.

### Them node moi

Sua ca hai noi (dung chung chuoi `type`):

- `src/automation/src/nodes/catalog.js` - icon, nhan, cac o nhap (giao dien tu sinh theo day)
- `src/main/automation/actions.js` - phan thuc thi bang Playwright

Node luu tai `%APPDATA%\auto-test-core-hidemium\scripts\<id>.json`.

### Tai lieu huong dan node

Bam nut **Huong dan** o dashboard hoac tren thanh cong cu man flow -> hien tai lieu
day du cua ca 52 node (icon, mo ta, cac cong ra, bang tham so, kich ban mau, o tim kiem).

Tai lieu duoc **sinh tu dong** tu `catalog.js` nen khong bao gio lech voi app.
Them / sua node xong thi chay:

```bash
npm run docs:nodes
```

Ket qua: `src/automation/docs/huong-dan-node.html` (mo trong app) va `noi-dung.html`
(ban chi co noi dung, de dang len web).
