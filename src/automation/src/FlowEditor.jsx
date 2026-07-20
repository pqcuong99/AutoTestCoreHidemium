/**
 * MAN FLOW - canvas keo tha node automation.
 *
 * - Keo node tu Palette tha vao canvas.
 * - Noi node bang cach keo tu handle phai sang handle trai cua node sau.
 * - Moi day noi co nut xoa o giua (DeletableEdge).
 * - Bam Luu de ghi xuong %APPDATA%, bam Chay de main process thuc thi bang Playwright.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Square, Eraser, BookOpen } from 'lucide-react';

import Palette from './Palette';
import Inspector from './Inspector';
import AutoNode, { PORTS } from './nodes/AutoNode';
import DeletableEdge from './edges/DeletableEdge';
import { defaultParams, NODE_MAP } from './nodes/catalog';

const nodeTypes = { auto: AutoNode };
const edgeTypes = { deletable: DeletableEdge };

const EDGE_OPTIONS = {
  type: 'deletable',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#8b9bb8' },
  style: { stroke: '#8b9bb8', strokeWidth: 2 },
};

/** Day noi mang mau cua cong ma no xuat phat -> nhin la biet nhanh nao. */
function edgeStyle(sourceHandle) {
  const color = PORTS[sourceHandle]?.color || '#8b9bb8';
  return {
    style: { stroke: color, strokeWidth: 2, ...(sourceHandle === 'error' ? { strokeDasharray: '6 4' } : {}) },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
  };
}

let seq = 0;
const newId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Kich ban doc tu file chi luu du lieu nghiep vu.
 * Phai gan lai `type` cua React Flow, khong thi no khong biet dung component nao ve.
 */
const normalizeNodes = (list = []) =>
  list.map((n) => ({ ...n, type: 'auto', data: { ...n.data, status: null } }));

const normalizeEdges = (list = []) =>
  list.map((e) => ({ ...EDGE_OPTIONS, ...e, ...edgeStyle(e.sourceHandle), type: 'deletable' }));

function Editor({ script, onBack, onDocs }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(normalizeNodes(script.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(normalizeEdges(script.edges));
  const [name, setName] = useState(script.name || 'Kich ban moi');
  const [selectedId, setSelectedId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(true);

  const wrapRef = useRef(null);
  const logRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  // ---- Nhan su kien chay tu main process ----
  useEffect(() => {
    const off = window.api.automation.onEvent((evt) => {
      if (evt.type === 'log') {
        setLogs((l) => [...l.slice(-499), evt]);
      } else if (evt.type === 'node-status') {
        setNodes((ns) =>
          ns.map((n) => (n.id === evt.nodeId ? { ...n, data: { ...n.data, status: evt.status } } : n))
        );
      } else if (evt.type === 'finish') {
        setRunning(false);
        setLogs((l) => [...l, { message: evt.error ? 'Ket thuc co loi: ' + evt.error : 'Hoan tat.', kind: evt.error ? 'err' : 'ok' }]);
      }
    });
    return off;
  }, [setNodes]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Bat ky thay doi nao cung danh dau la chua luu.
  useEffect(() => { setSaved(false); }, [nodes, edges, name]);

  // ---- Keo tha tu palette ----
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/automation-node');
      if (!type || !NODE_MAP[type]) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setNodes((ns) => ns.concat({
        id: newId(),
        type: 'auto',
        position,
        data: { type, label: '', params: defaultParams(type) },
      }));
    },
    [screenToFlowPosition, setNodes]
  );

  const onConnect = useCallback(
    (params) => setEdges((es) => addEdge({ ...params, ...EDGE_OPTIONS, ...edgeStyle(params.sourceHandle) }, es)),
    [setEdges]
  );

  // ---- Chay ----
  const runFrom = useCallback(async (startNodeId) => {
    setLogs([]);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: null } })));
    setRunning(true);
    const res = await window.api.automation.run({
      name,
      nodes: nodes.map(({ id, position, data }) => ({ id, position, data })),
      edges,
      startNodeId,
    });
    if (!res?.ok) {
      setRunning(false);
      setLogs((l) => [...l, { message: res?.error || 'Khong chay duoc.', kind: 'err' }]);
    }
  }, [name, nodes, edges, setNodes]);

  // Node can callback de nut Start tren no goi nguoc len day.
  const nodesWithHandlers = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, onRunFrom: runFrom } })),
    [nodes, runFrom]
  );

  const onSave = async () => {
    const res = await window.api.automation.save({
      id: script.id,
      name,
      // Bo onRunFrom / status (ham va trang thai tam) - chi luu du lieu thuan.
      nodes: nodes.map(({ id, position, data }) => ({
        id, position, type: 'auto',
        data: { type: data.type, label: data.label, params: data.params },
      })),
      edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
        id, source, target, sourceHandle, targetHandle, type: 'deletable',
      })),
    });
    if (res?.ok) setSaved(true);
  };

  const onStop = async () => {
    await window.api.automation.stop();
    setRunning(false);
  };

  const clearAll = () => {
    if (!nodes.length) return;
    if (!confirm('Xoa toan bo node tren canvas?')) return;
    setNodes([]);
    setEdges([]);
  };

  const selected = nodes.find((n) => n.id === selectedId) || null;

  const updateSelected = (params, label) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, params, ...(label !== undefined ? { label } : {}) } }
          : n
      )
    );
  };

  return (
    <div className="editor">
      <header className="editor__bar">
        <button className="btn btn--ghost" onClick={onBack} title="Ve dashboard">
          <ArrowLeft size={15} /> Quay lai
        </button>

        <input
          className="editor__name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ten kich ban"
        />
        {!saved && <span className="badge badge--warn">chua luu</span>}

        <div className="editor__spacer" />

        <button className="btn btn--ghost" onClick={onDocs} title="Mo tai lieu huong dan node">
          <BookOpen size={15} /> Huong dan
        </button>
        <button className="btn btn--ghost" onClick={clearAll} title="Xoa het node">
          <Eraser size={15} /> Xoa canvas
        </button>
        <button className="btn" onClick={onSave}>
          <Save size={15} /> Luu
        </button>
        {running ? (
          <button className="btn btn--danger" onClick={onStop}>
            <Square size={15} /> Dung
          </button>
        ) : (
          <button className="btn btn--primary" onClick={() => runFrom(null)}>
            <Play size={15} /> Chay
          </button>
        )}
      </header>

      <div className="editor__main">
        <Palette />

        <div className="canvas" ref={wrapRef} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={EDGE_OPTIONS}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={16} size={1} color="#3d4d69" />
            <Controls />
            <MiniMap pannable zoomable nodeColor="#5d7191" maskColor="rgba(26,36,55,.65)" />
          </ReactFlow>

          {!nodes.length && (
            <div className="canvas__hint">
              Keo node tu cot trai tha vao day de bat dau.
              <br />
              Noi cac node lai voi nhau de tao thanh quy trinh chay lan luot.
            </div>
          )}
        </div>

        <Inspector node={selected} onChange={updateSelected} onClose={() => setSelectedId(null)} />
      </div>

      <footer className="editor__log" ref={logRef}>
        {logs.length === 0 && <div className="log-line log-line--dim">Chua co log. Bam Chay de thuc thi kich ban.</div>}
        {logs.map((l, i) => (
          <div key={i} className={`log-line log-line--${l.kind || 'info'}`}>
            {l.nodeLabel && <span className="log-node">[{l.nodeLabel}]</span>} {l.message}
          </div>
        ))}
      </footer>
    </div>
  );
}

export default function FlowEditor(props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
