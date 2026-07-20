/**
 * Dieu huong giua Dashboard, man Flow va man Huong dan.
 * Ba man nen dung state don gian, khong can router.
 *
 * onExit: dong han lop phu Automation, tra ve man chinh cua app.
 */
import { useState } from 'react';
import Dashboard from './Dashboard';
import FlowEditor from './FlowEditor';
import Docs from './Docs';

export default function App({ onExit }) {
  const [editing, setEditing] = useState(null);
  const [showDocs, setShowDocs] = useState(false);

  if (showDocs) return <Docs onBack={() => setShowDocs(false)} />;

  return editing ? (
    <FlowEditor
      script={editing}
      onBack={() => setEditing(null)}
      onDocs={() => setShowDocs(true)}
    />
  ) : (
    <Dashboard
      onOpen={setEditing}
      onDocs={() => setShowDocs(true)}
      onExit={onExit}
    />
  );
}
