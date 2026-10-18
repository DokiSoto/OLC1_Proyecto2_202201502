import React from 'react';

const format = value => value === null || value === undefined ? '—' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);

export default function DataTable({ rows = [], columns }) {
  if (!rows.length) return <p className="empty">Sin registros para esta ejecución.</p>;
  const fields = columns ?? Object.keys(rows[0]).map(key => [key, key]);
  return <div className="table-scroll"><table><thead><tr>
    {fields.map(([key, label]) => <th key={key}>{label}</th>)}
  </tr></thead><tbody>{rows.map((row, index) => <tr key={index}>
    {fields.map(([key]) => <td key={key}>{format(row[key])}</td>)}
  </tr>)}</tbody></table></div>;
}