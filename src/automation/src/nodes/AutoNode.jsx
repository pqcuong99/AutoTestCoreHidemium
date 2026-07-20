/**
 * Node automation ve tren canvas.
 *
 * Bo cuc:
 *   [dau vao] ─┬ tieu de + icon + nut Start / Delete
 *              ├ dong cong ra 1   (o)
 *              ├ dong cong ra 2   (o)
 *              └ dong cong "Loi"  (o)
 *
 * MOI cong ra la mot DONG rieng, handle neo vao chinh dong do
 * -> khong con canh lech nhu khi dat `top` cung.
 *
 * Node thuong co 1 cong ra "Tiep". Node re nhanh co nhieu cong (Dung/Sai, Moi vong/Xong).
 * Moi node deu co them cong "Loi": chay loi thi di theo day nay thay vi dung han.
 */
import { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Play, Trash2, AlertCircle, RotateCcw } from 'lucide-react';
import { NODE_MAP, GROUPS } from './catalog';

/** Ten hien thi + mau cua tung loai cong ra. */
export const PORTS = {
  next:  { label: 'Tiep theo', color: '#34d399' },
  true:  { label: 'Dung',      color: '#34d399' },
  false: { label: 'Sai',       color: '#fbbf24' },
  loop:  { label: 'Moi vong',  color: '#a78bfa' },
  done:  { label: 'Xong',      color: '#38bdf8' },
  error: { label: 'Loi',       color: '#f87171' },
};

/** Mau dau vao. */
export const IN_COLOR = '#60a5fa';

/** Node lap can them dau vao rieng o duoi de nhan day quay nguoc ve. */
const LOOP_TYPES = new Set(['logic.loop', 'logic.forEach', 'logic.while']);

function AutoNode({ id, data, selected }) {
  const { setNodes, setEdges } = useReactFlow();
  const def = NODE_MAP[data.type];

  if (!def) {
    return (
      <div className="auto-node auto-node--unknown">
        <AlertCircle size={16} />
        <span>Node khong ro: {data.type}</span>
      </div>
    );
  }

  const color = GROUPS[def.group]?.color || '#64748b';
  const Icon = def.icon;

  // Cong ra: node re nhanh dung branches cua no, node thuong chi co "next".
  // Node nao cung co them "error" o cuoi.
  const outs = [...(def.branches || ['next']), 'error'];
  const isLoop = LOOP_TYPES.has(def.type);

  const onDelete = (e) => {
    e.stopPropagation();
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((ed) => ed.source !== id && ed.target !== id));
  };

  const onStart = (e) => {
    e.stopPropagation();
    data.onRunFrom?.(id);
  };

  return (
    <div
      className={`auto-node ${selected ? 'is-selected' : ''} ${data.status ? 'is-' + data.status : ''}`}
      style={{ '--node-color': color }}
    >
      {/* Dau vao chinh */}
      <Handle
        type="target"
        position={Position.Left}
        className="auto-handle auto-handle--in"
        style={{ '--h': IN_COLOR }}
      />

      <div className="auto-node__bar" />

      <div className="auto-node__body">
        <span className="auto-node__icon"><Icon size={16} /></span>

        <div className="auto-node__text">
          <div className="auto-node__label">{data.label || def.label}</div>
          <div className="auto-node__sub">{summarize(def, data.params)}</div>
        </div>

        <div className="auto-node__tools">
          <button className="auto-icon-btn" title="Chay tu node nay" onClick={onStart}>
            <Play size={13} />
          </button>
          <button className="auto-icon-btn auto-icon-btn--danger" title="Xoa node" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="auto-node__ports">
        {outs.map((key) => {
          const port = PORTS[key];
          return (
            <div key={key} className={`auto-port auto-port--${key}`} style={{ '--h': port.color }}>
              <span className="auto-port__label">{port.label}</span>
              <Handle
                id={key}
                type="source"
                position={Position.Right}
                className="auto-handle auto-handle--out"
                style={{ '--h': port.color }}
              />
            </div>
          );
        })}
      </div>

      {/* Dau vao phu cua vong lap: noi node cuoi trong than vong lap quay nguoc ve day. */}
      {isLoop && (
        <div className="auto-loopback" title="Noi node cuoi cua than vong lap quay ve day">
          <RotateCcw size={11} />
          <span>Quay lai vong lap</span>
          <Handle
            id="back"
            type="target"
            position={Position.Bottom}
            className="auto-handle auto-handle--back"
            style={{ '--h': PORTS.loop.color }}
          />
        </div>
      )}
    </div>
  );
}

/** Dong mo ta ngan duoi ten node: lay field dau tien co gia tri. */
function summarize(def, params = {}) {
  for (const f of def.fields) {
    const v = params[f.key];
    if (v === undefined || v === '' || v === null) continue;
    const text = String(v);
    return text.length > 34 ? text.slice(0, 34) + '...' : text;
  }
  return def.desc.length > 38 ? def.desc.slice(0, 38) + '...' : def.desc;
}

export default memo(AutoNode);
