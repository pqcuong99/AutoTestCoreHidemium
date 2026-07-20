/**
 * Cot phai: sua tham so cua node dang chon.
 * Field duoc dung tu catalog nen them node moi la tu dong co form.
 */
import { NODE_MAP, GROUPS } from './nodes/catalog';

export default function Inspector({ node, onChange, onClose }) {
  if (!node) {
    return (
      <aside className="inspector">
        <div className="inspector__empty">
          Chon mot node de sua tham so.
          <br />
          <br />
          Meo: dung <code>{'{{tenBien}}'}</code> trong o nhap de chen gia tri bien da gan truoc do.
        </div>
      </aside>
    );
  }

  const def = NODE_MAP[node.data.type];
  if (!def) {
    return <aside className="inspector"><div className="inspector__empty">Node khong ro kieu.</div></aside>;
  }

  const color = GROUPS[def.group]?.color;
  const Icon = def.icon;
  const params = node.data.params || {};

  const setParam = (key, value) => onChange({ ...params, [key]: value });

  return (
    <aside className="inspector">
      <header className="inspector__head" style={{ '--g': color }}>
        <span className="inspector__icon"><Icon size={16} /></span>
        <div>
          <div className="inspector__title">{def.label}</div>
          <div className="inspector__type">{def.type}</div>
        </div>
        <button className="inspector__close" onClick={onClose} title="Dong">&times;</button>
      </header>

      <p className="inspector__desc">{def.desc}</p>

      <div className="inspector__body">
        <label className="field">
          <span>Ten hien thi</span>
          <input
            value={node.data.label || ''}
            placeholder={def.label}
            onChange={(e) => onChange(params, e.target.value)}
          />
        </label>

        {def.fields.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>

            {f.kind === 'textarea' && (
              <textarea
                rows={4}
                value={params[f.key] ?? ''}
                placeholder={f.placeholder || ''}
                onChange={(e) => setParam(f.key, e.target.value)}
              />
            )}

            {f.kind === 'select' && (
              <select value={params[f.key] ?? f.def ?? ''} onChange={(e) => setParam(f.key, e.target.value)}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {f.kind === 'bool' && (
              <input
                type="checkbox"
                className="field__check"
                checked={Boolean(params[f.key] ?? f.def)}
                onChange={(e) => setParam(f.key, e.target.checked)}
              />
            )}

            {f.kind === 'number' && (
              <input
                type="number"
                value={params[f.key] ?? ''}
                placeholder={f.def !== undefined ? String(f.def) : ''}
                onChange={(e) => setParam(f.key, e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}

            {(!f.kind || f.kind === 'text') && (
              <input
                value={params[f.key] ?? ''}
                placeholder={f.placeholder || ''}
                onChange={(e) => setParam(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </aside>
  );
}
