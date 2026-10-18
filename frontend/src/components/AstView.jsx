import React, { useMemo, useRef, useState } from 'react';
import { downloadFile } from '../services/api.js';

function layout(root) {
  const nodes = [], edges = []; let nextLeaf = 0, maxDepth = 0;
  function visit(tree, depth) {
    const node = { id: nodes.length, label: tree.label, depth, x: 0, y: depth * 150 + 20 };
    nodes.push(node); maxDepth = Math.max(maxDepth, depth);
    const children = (tree.children ?? []).map(child => visit(child, depth + 1));
    node.x = children.length ? (children[0].x + children.at(-1).x) / 2 : nextLeaf++ * 240 + 20;
    for (const child of children) edges.push({ from: node, to: child });
    return node;
  }
  visit(root, 0);
  return { nodes, edges, width: Math.max(700, nextLeaf * 240 + 40), height: (maxDepth + 1) * 150 + 20 };
}

export default function AstView({ tree }) {
  const [zoom, setZoom] = useState(0.7), svg = useRef(null);
  const graph = useMemo(() => tree ? layout(tree) : null, [tree]);
  if (!graph) return <p className="empty">Analiza un programa para generar su AST.</p>;
  return <>
    <div className="ast-controls"><label>Zoom <input type="range" min="0.15" max="1.5" step="0.05"
      value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <button onClick={() => downloadFile('ast.svg', new XMLSerializer().serializeToString(svg.current), 'image/svg+xml')}>Descargar SVG</button>
      <span>{graph.nodes.length} nodos · desplázate horizontal y verticalmente</span>
    </div>
    <div className="ast-scroll"><svg ref={svg} xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Árbol de sintaxis abstracta" width={graph.width * zoom} height={graph.height * zoom}
      viewBox={`0 0 ${graph.width} ${graph.height}`}>
      <rect width={graph.width} height={graph.height} fill="#f4f8fc" />
      {graph.edges.map((edge, index) => <line key={index} stroke="#7c98ad" strokeWidth="2"
        x1={edge.from.x + 105} y1={edge.from.y + 100} x2={edge.to.x + 105} y2={edge.to.y} />)}
      {graph.nodes.map(node => <g key={node.id} transform={`translate(${node.x},${node.y})`}>
        <title>{node.label}</title><rect width="210" height="100" rx="10" fill="#fff" stroke="#167b89" strokeWidth="2" />
        {node.label.split('\n').slice(0, 5).map((line, i) => <text key={i} x="10" y={20 + i * 17}
          fill="#102c40" fontFamily="monospace" fontSize="11">{line.length > 28 ? line.slice(0, 27) + '…' : line}</text>)}
      </g>)}
    </svg></div>
  </>;
}