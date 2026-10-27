import React, { useMemo, useRef, useState } from 'react';
import { downloadFile } from '../services/api.js';
const PAGE_SIZE = 12;
function indexTree(root) {
  const entries = [], stack = [{ node: root, path: [] }];
  while (stack.length) {
    const entry = stack.pop(); entries.push(entry);
    const children = entry.node.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], path: [...entry.path, i] });
  }
  return entries;
}
function caption(node) {
  return String(node?.label ?? 'Nodo');
}
export default function AstView({ tree }) {
  const [path, setPath] = useState([]), [page, setPage] = useState(0);
  const [query, setQuery] = useState(''), [zoom, setZoom] = useState(1);
  const svg = useRef(null);
  const entries = useMemo(() => tree ? indexTree(tree) : [], [tree]);
  if (!tree) return <p className="empty">Analiza un programa para generar su AST.</p>;
  let selected = tree;
  for (const index of path) selected = selected.children?.[index] ?? tree;
  const children = selected.children ?? [];
  const pages = Math.max(1, Math.ceil(children.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1), offset = current * PAGE_SIZE;
  const visible = children.slice(offset, offset + PAGE_SIZE);
  const height = 190 + Math.ceil(visible.length / 3) * 160;
  const navigate = next => { setPath(next); setPage(0); };
  const matches = query.trim() ? entries.filter(entry => caption(entry.node).toLowerCase().includes(query.toLowerCase())).slice(0, 40) : [];
  function box(node, x, y, action, key) {
    return <g key={key} transform={`translate(${x},${y})`} role={action ? 'button' : undefined}
      tabIndex={action ? 0 : undefined} aria-label={action ? `Explorar ${caption(node)}` : undefined}
      onClick={action} onKeyDown={event => { if (action && ['Enter', ' '].includes(event.key)) { event.preventDefault(); action(); } }}
      style={{ cursor: action ? 'pointer' : 'default' }}>
      <title>{caption(node)}{node.line ? ` · Línea ${node.line}, columna ${node.column}` : ''}</title>
      <rect width="260" height="112" rx="10" fill="#fff" stroke="#167b89" strokeWidth="2" />
      {caption(node).split('\n').slice(0, 4).map((line, i) => <text key={i} x="12" y={23 + i * 18}
        fill="#102c40" fontFamily="monospace" fontSize="12">{line.length > 32 ? line.slice(0, 31) + '…' : line}</text>)}
      <text x="12" y="100" fill="#167b89" fontFamily="sans-serif" fontSize="10">
        {(node.children?.length ?? 0)} hijos{action ? ' · clic para explorar' : ''}
      </text>
    </g>;
  }
  return <>
    <div className="ast-controls">
      <button disabled={!path.length} onClick={() => navigate([])}>Raíz</button>
      <button disabled={!path.length} onClick={() => navigate(path.slice(0, -1))}>Subir</button>
      <label>Zoom <input type="range" min="0.4" max="1.5" step="0.1" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <button onClick={() => downloadFile('ast-vista.svg', new XMLSerializer().serializeToString(svg.current), 'image/svg+xml')}>Descargar vista SVG</button>
      <button onClick={() => downloadFile('ast-completo.json', JSON.stringify(tree, null, 2), 'application/json')}>AST completo JSON</button>
    </div>
    <p className="ast-info">{entries.length} nodos totales · Nivel {path.length}. Explora los hijos sin cargar un gráfico gigante.</p>
    <label className="ast-search">Buscar nodo <input placeholder="Ej.: FunctionDeclaration o factorial" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {query.trim() && <div className="ast-matches">{matches.length ? matches.map((entry, i) =>
      <button key={i} onClick={() => { navigate(entry.path); setQuery(''); }}>{caption(entry.node).replaceAll('\n', ' · ')}</button>) : <p>Sin coincidencias.</p>}</div>}
    <pre className="node-details">{caption(selected)}{selected.line ? `\nLínea ${selected.line}, columna ${selected.column}` : ''}</pre>
    <div className="table-controls"><span>{children.length} hijos · Página {current + 1} de {pages}</span>
      <button disabled={current === 0} onClick={() => setPage(current - 1)}>Hijos anteriores</button>
      <button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Más hijos</button></div>
    <div className="ast-scroll"><svg ref={svg} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Árbol de sintaxis abstracta" width={900 * zoom} height={height * zoom} viewBox={`0 0 900 ${height}`}>
      <rect width="900" height={height} fill="#f4f8fc" />
      {visible.map((child, i) => <path key={i} fill="none" stroke="#7c98ad" strokeWidth="2"
        d={`M 450 132 L 450 ${150 + Math.floor(i / 3) * 160} L ${150 + (i % 3) * 300} ${150 + Math.floor(i / 3) * 160} L ${150 + (i % 3) * 300} ${180 + Math.floor(i / 3) * 160}`} />)}
      {box(selected, 320, 20, null, 'root')}
      {visible.map((child, i) => box(child, 20 + (i % 3) * 300, 180 + Math.floor(i / 3) * 160,
        () => navigate([...path, offset + i]), i))}
    </svg></div>
  </>;
}