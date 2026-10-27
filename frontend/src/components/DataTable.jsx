import React, { useEffect, useState } from 'react';

const format = value => value === null || value === undefined ? '—' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);
const PAGE_SIZE = 100;
export default function DataTable({ rows, columns }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows]);
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) return <p className="empty">Sin registros para esta ejecución.</p>;
  const fields = columns ?? Object.keys(data[0]).map(key => [key, key]);
  const pages = Math.ceil(data.length / PAGE_SIZE), current = Math.min(page, pages - 1);
  return <>
    <div className="table-controls">
      <span>{data.length} registros · Página {current + 1} de {pages}</span>
      <button disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</button>
      <button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Siguiente</button>
    </div>
    <div className="table-scroll"><table><thead><tr>
      {fields.map(([key, label]) => <th key={key}>{label}</th>)}
    </tr></thead><tbody>{data.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((row, index) => <tr key={index}>
      {fields.map(([key]) => <td key={key}>{format(row?.[key])}</td>)}
    </tr>)}</tbody></table></div>
  </>;
}