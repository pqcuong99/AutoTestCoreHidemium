/**
 * Diem gan man Automation VAO CUA SO CHINH.
 *
 * Truoc day man nay chay o cua so rieng. Gio no la mot lop phu ben trong
 * cua so chinh -> ca app chi con dung mot cua so Windows.
 *
 * Build ra dang IIFE (khong phai module) nen index.html cua man chinh
 * nap duoc bang the <script> thuong, khong vuong CORS cua file://.
 *
 * Dung: window.AutomationApp.open() / .close()
 *
 * LUU Y: phai EXPORT open/close chu khong duoc tu gan window.AutomationApp.
 * Build IIFE sinh ra `var AutomationApp = (function(){...})()` - gia tri tra ve
 * la object export, no ghi de len bien minh tu gan ben trong. Export moi dung.
 */
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const HOST_ID = 'automation-root';

let root = null;

const host = () => document.getElementById(HOST_ID);

export function open() {
  const el = host();
  if (!el) {
    console.error('[automation] khong thay #' + HOST_ID + ' trong trang.');
    return;
  }
  el.hidden = false;
  // Chi dung React len o lan mo dau tien, cac lan sau giu nguyen trang thai.
  if (!root) {
    root = createRoot(el);
    root.render(<App onExit={close} />);
  }
}

export function close() {
  const el = host();
  if (el) el.hidden = true;
}
