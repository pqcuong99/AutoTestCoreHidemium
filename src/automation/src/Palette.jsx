/**
 * Cot trai: danh sach node co the keo vao canvas.
 * Keo tha dung HTML5 drag-and-drop, du lieu truyen di la `type` cua node.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { groupedNodes } from './nodes/catalog';

export default function Palette() {
  const [q, setQ] = useState('');
  const groups = useMemo(() => groupedNodes(), []);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (n) => n.label.toLowerCase().includes(key) || n.type.toLowerCase().includes(key)
        ),
      }))
      .filter((g) => g.items.length);
  }, [groups, q]);

  const onDragStart = (e, type) => {
    e.dataTransfer.setData('application/automation-node', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="palette">
      <div className="palette__search">
        <Search size={14} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tim node..."
        />
      </div>

      <div className="palette__list">
        {filtered.map((g) => (
          <div key={g.key} className="palette__group">
            <div className="palette__group-head" style={{ '--g': g.color }}>
              <span className="dot" />
              {g.label}
              <span className="count">{g.items.length}</span>
            </div>

            {g.items.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.type}
                  className="palette__item"
                  style={{ '--g': g.color }}
                  draggable
                  onDragStart={(e) => onDragStart(e, n.type)}
                  title={n.desc}
                >
                  <span className="palette__icon"><Icon size={15} /></span>
                  <span className="palette__label">{n.label}</span>
                </div>
              );
            })}
          </div>
        ))}

        {!filtered.length && <div className="palette__empty">Khong tim thay node nao.</div>}
      </div>
    </aside>
  );
}
