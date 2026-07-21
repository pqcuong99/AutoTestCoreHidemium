# Hướng dẫn bổ sung test theo OS (ví dụ macOS)

Tài liệu này mô tả cách thêm / bật policy test cho **macOS** (và các OS khác) trên AutoTestCoreHidemium **mà không copy** scraper BrowserLeaks.

## Ý tưởng

| Lớp | Vai trò | Có fork theo OS? |
|-----|---------|------------------|
| Settings `targetOs` | Đầu vào: `windows` / `macos` / `ios` / `android` | Không |
| `src/shared/platformPolicy/<os>.js` | Skip check, skip field, alias so sánh | **Có — mỗi OS 1 file** |
| `recipes.js` + CDP | Scrape DOM BrowserLeaks | **Không** (dùng chung) |

```
Settings (chọn macos)
    → store.targetOs
    → runner options.targetOs
    → platformPolicy.resolve('macos')
    → browserleaks áp skipChecks / skipConfigKeys
    → recipes.js (DOM chung)
```

Trước mắt chỉ **Windows** (`supported: true`). macOS đang là stub.

---

## Checklist thêm macOS

### 1. Viết policy — `src/shared/platformPolicy/macos.js`

Copy cấu trúc từ `windows.js`, chỉnh cho Mac:

```js
/**
 * Policy test fingerprint macOS (Chromium spoof trên Hidemium).
 */
module.exports = {
  id: 'macos',
  label: 'macOS',
  supported: true, // ← bật khi sẵn sàng
  // reason: '...', // xóa khi supported: true

  /**
   * checkKey bỏ qua trên BrowserLeaks (và site khác nếu runner đọc policy).
   * Gợi ý Mac (điều chỉnh theo thực tế):
   * - mac_address / desktop_name: web thường không có
   * - font: scrape khó → có thể vẫn skip hoặc làm sau
   */
  skipChecks: ['font', 'mac_address', 'desktop_name'],

  /**
   * configKey không so sánh (không có trên web / spoof mode).
   * Mac thường khác Win ở manufacturer / model / platform string.
   */
  skipConfigKeys: [
    'hidemium.navigator.physical_memory',
    'hidemium.webgl.mode',
    // ví dụ: bỏ manufacturer khỏi skip nếu Mac cần check model/manufacturer
  ],

  /**
   * Soft-match khi expected và actual khác cách viết nhưng cùng nghĩa.
   * Dùng sau khi compareOne hỗ trợ matchAliases (nếu chưa wire thì để {}).
   *
   * Ví dụ ý tưởng:
   *   'macintel': ['macintosh', 'mac os x', 'macos']
   */
  matchAliases: {
    // 'MacIntel': ['Macintosh', 'Mac OS X'],
  },
};
```

Tham chiếu Windows hiện tại: [`windows.js`](../src/shared/platformPolicy/windows.js).

### 2. Đăng ký / bật UI

**`src/shared/platformPolicy/index.js`**

- `macos` đã có trong `POLICIES` và alias `mac` / `darwin`.
- Đổi `OS_OPTIONS`:

```js
{ id: 'macos', labelKey: 'os.macos', supported: true },
```

**`src/renderer/js/settings.js`** — trong `renderOsOptions()`:

```js
{ id: 'macos', label: t('os.macos'), supported: true },
```

**`src/renderer/index.html`** (nếu còn option cứng):

```html
<option value="macos">macOS</option>
<!-- bỏ disabled -->
```

**i18n** — cập nhật label nếu cần:

- `os.macos`: bỏ chữ “(sắp có)” / “(coming soon)”
- `settings.targetOs.hint`: “Hiện hỗ trợ Windows và macOS.”

### 3. Không cần đụng (thường)

- `recipes.js` selectors (`#js-*`, `#gpu-limits`, …) — DOM BrowserLeaks giống nhau giữa OS spoof.
- `cdp.js` — vẫn Chromium + CDP trên máy chạy AutoTest.
- `configMapper.js` — chỉ sửa nếu Mac dùng **tên key config khác** Win (ví dụ không còn `registry.*`). Khi đó thêm alias trong policy hoặc mở rộng mapper theo `platform.id`.

### 4. Kiểm thử

1. Restart Electron (`npm run dev`).
2. Settings → **OS cần test** = macOS.
3. Chạy profile fingerprint Mac.
4. Log kỳ vọng:
   - `OS test: macOS`
   - `BrowserLeaks: targetOs=macos (policy ok)`
5. So Detail Log: field trong `skipChecks` / `skipConfigKeys` phải SKIP theo policy Mac, không FAIL oan.

---

## Khi nào phải sửa recipes (hiếm)

Chỉ khi:

- BrowserLeaks đổi HTML theo UA/OS (selector khác), hoặc
- Cần field Mac-only mới (thêm `FIELD_OVERRIDE` / whitelist), hoặc
- So sánh platform cần `matchAliases` — khi đó wire `platform.matchAliases` vào `compareOne` trong `browserleaks/index.js` (hiện policy đã có field, compare có thể chưa đọc).

**Không** tạo `recipes-macos.js` song song.

---

## iOS / Android (cùng pattern)

| OS | File policy | Việc làm |
|----|-------------|----------|
| iOS | `ios.js` | Giống macOS: `supported: true` + skip phù hợp mobile (`desktop_name`, …); bật Settings |
| Android | `android.js` | Tương tự; chú ý `form_factors` / `max_touch` / `model` |

Nếu sau này runtime **không còn CDP desktop** (device thật), phải tách BrowserAdapter — đó là việc khác, không nằm trong policy file.

---

## Tóm tắt “viết macOS như nào”

1. Sửa **`macos.js`**: `supported: true` + `skipChecks` / `skipConfigKeys` / (tuỳ) `matchAliases`.
2. Bật **`supported: true`** ở Settings UI + `OS_OPTIONS`.
3. Chạy profile Mac, chỉnh skip cho đến khi PASS/FAIL phản ánh đúng spoof.
4. Giữ **recipes/CDP dùng chung**.

Xong.
