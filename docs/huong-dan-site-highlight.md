# Site highlight (dùng chung mọi trang test)

Module: [`src/shared/siteHighlight.js`](../src/shared/siteHighlight.js)

Highlight từng dòng/key trong ô Detail Log khi so sánh **web vs config**.

## Ba loại cần nổi bật

| Status | Ý nghĩa | Mark / màu |
|--------|---------|------------|
| `mismatch` | Web khác config | `✗` đỏ |
| `noConfig` | Có trên web, không có (hoặc placeholder) trong config | `⚠ no config` vàng |
| `missingOnWeb` | Config có giá trị thật, web trống / không scrape được | `⚠ missing on web` tím |

Thêm: `ok`, `info` (chỉ hiển thị, vd `config=default`).

## Dùng trong site runner (BrowserLeaks + CreepJS)

Cùng contract field → `summarizeFieldResults` → Detail Log:

```js
const { summarizeFieldResults } = require('../../shared/siteHighlight');

// Sau khi scrape + so sanh, moi field:
// {
//   label, configKey, expected, actual,
//   pass, skipped?, noConfig?, missingOnWeb?, infoOnly?, match?
// }

const result = summarizeFieldResults(fieldResults, {
  discoverMode: true, // webgl_param / webgpu: hien key thua tren web
});

// Tra ve Detail Log:
// { state: 'pass'|'fail'|'skipped', value: string, pass: boolean, lines: [{ text, status }] }
```

- **BrowserLeaks:** `checks/browserleaks/index.js` → `summarize()`
- **CreepJS:** `checks/creepjs/helpers.js` → `lineResult` / `infoLine` / `summarizeLines` / `finishCheck`

Pipeline emit `lines` qua `site-result` — renderer tô màu theo `status` (`.kv-mismatch` / `.kv-no-config` / …). Không còn nhánh CSS `site-line-*` riêng cho CreepJS.

## Chú thích màu (Detail Log)

Thanh legend trên bảng: khớp · lệch config (đỏ) · thiếu config (vàng) · thiếu trên web (tím) · chỉ hiển thị (xám).

## Renderer

- Script: `siteHighlight.js` (đã gắn trong `index.html`)
- CSS: `.kv-mismatch` / `.kv-no-config` / `.kv-missing-web` + `.dl-legend` trong `detailLog.css`
- Fallback: nếu không có `lines[]`, parse suffix `✗` / `⚠ …` từ `value`

## Không làm gì

- Không nhét logic màu vào từng `recipes.js`
- Không copy highlight sang từng site — chỉ gọi `summarizeFieldResults`
