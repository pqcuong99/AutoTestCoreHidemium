/**
 * Man tai lieu huong dan node.
 *
 * Nhung file HTML da sinh san bang <iframe>: CSS cua tai lieu va CSS cua app
 * nam o hai tai lieu khac nhau nen khong the de len nhau.
 */
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';

/** Duong dan tinh tu man chinh (src/renderer/index.html) toi file tai lieu. */
const DOCS_URL = '../automation/docs/huong-dan-node.html';

export default function Docs({ onBack }) {
  return (
    <div className="docs">
      <header className="docs__bar">
        <button className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={15} /> Quay lai
        </button>
        <BookOpen size={15} />
        <span className="docs__title">Huong dan node</span>
        <div className="docs__spacer" />
        <button
          className="btn btn--ghost"
          title="Mo bang trinh duyet ngoai"
          onClick={() => window.api.shell.openExternal(new URL(DOCS_URL, location.href).href)}
        >
          <ExternalLink size={14} /> Mo ngoai
        </button>
      </header>
      <iframe className="docs__frame" src={DOCS_URL} title="Huong dan node Automation" />
    </div>
  );
}
