/**
 * Day noi giua hai node, co nut xoa hien ngay giua day.
 * Dung bezier cho mem, EdgeLabelRenderer de nut khong bi bien dang khi zoom.
 */
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';
import { X } from 'lucide-react';

export default function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, markerEnd, style, selected,
}) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const onDelete = (e) => {
    e.stopPropagation();
    setEdges((es) => es.filter((ed) => ed.id !== id));
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          className={`edge-del ${selected ? 'is-selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          title="Xoa day noi"
          onClick={onDelete}
        >
          <X size={11} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
