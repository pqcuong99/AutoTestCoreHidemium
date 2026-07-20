/**
 * MAN DASHBOARD AUTOMATION.
 * Liet ke cac kich ban da luu + nut icon "Tao kich ban" de mo man flow.
 */
import { useEffect, useState } from 'react';
import { Plus, Workflow, Trash2, Pencil, Copy, Clock, BookOpen, X } from 'lucide-react';

export default function Dashboard({ onOpen, onDocs, onExit }) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const res = await window.api.automation.list();
    setScripts(res?.scripts || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const onCreate = () => {
    onOpen({ id: null, name: 'Kich ban moi', nodes: [], edges: [] });
  };

  const onEdit = async (id) => {
    const res = await window.api.automation.get(id);
    if (res?.ok) onOpen(res.script);
  };

  const onDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!confirm(`Xoa kich ban "${name}"?`)) return;
    await window.api.automation.remove(id);
    reload();
  };

  const onDuplicate = async (e, script) => {
    e.stopPropagation();
    const full = await window.api.automation.get(script.id);
    if (!full?.ok) return;
    await window.api.automation.save({
      id: null,
      name: full.script.name + ' (copy)',
      nodes: full.script.nodes,
      edges: full.script.edges,
    });
    reload();
  };

  return (
    <div className="dash">
      <header className="dash__head">
        <div className="dash__title">
          <span className="dash__logo"><Workflow size={20} /></span>
          <div>
            <h1>Automation</h1>
            <p>Tao va chay kich ban tu dong tren profile Hidemium</p>
          </div>
        </div>

        <div className="dash__actions">
          <button className="btn btn--lg" onClick={onDocs} title="Mo tai lieu huong dan tat ca node">
            <BookOpen size={17} /> Huong dan
          </button>
          <button className="btn btn--primary btn--lg" onClick={onCreate} title="Tao kich ban automation">
            <Plus size={18} /> Tao kich ban
          </button>
          <button className="btn btn--lg" onClick={onExit} title="Dong Automation, ve man chinh">
            <X size={17} /> Dong
          </button>
        </div>
      </header>

      {loading ? (
        <div className="dash__empty">Dang tai...</div>
      ) : scripts.length === 0 ? (
        <div className="dash__empty">
          <Workflow size={40} strokeWidth={1.2} />
          <p>Chua co kich ban nao.</p>
          <button className="btn btn--primary" onClick={onCreate}>
            <Plus size={16} /> Tao kich ban dau tien
          </button>
        </div>
      ) : (
        <div className="dash__grid">
          {scripts.map((s) => (
            <article key={s.id} className="card" onClick={() => onEdit(s.id)}>
              <div className="card__icon"><Workflow size={18} /></div>
              <div className="card__body">
                <h3>{s.name}</h3>
                <div className="card__meta">
                  <span>{s.nodeCount} node</span>
                  <span className="card__dot" />
                  <span><Clock size={11} /> {formatTime(s.updatedAt)}</span>
                </div>
              </div>
              <div className="card__tools">
                <button className="auto-icon-btn" title="Sua" onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}>
                  <Pencil size={14} />
                </button>
                <button className="auto-icon-btn" title="Nhan ban" onClick={(e) => onDuplicate(e, s)}>
                  <Copy size={14} />
                </button>
                <button className="auto-icon-btn auto-icon-btn--danger" title="Xoa" onClick={(e) => onDelete(e, s.id, s.name)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
