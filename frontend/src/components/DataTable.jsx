import React, { useEffect, useState } from 'react';

const format = value => value === null || value === undefined ? '—' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);
export default function DataTable({ rows, columns }) {
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) return <p className="empty">NO hay</p>;
  const fields = columns ?? Object.keys(data[0]).map(key => [key, key]);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {fields.map(([key, label]) => <th key={key}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {fields.map(([key]) => <td key={key}>{format(row?.[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}