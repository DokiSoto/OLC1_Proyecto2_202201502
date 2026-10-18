const API = 'http://localhost:8080/api';

export async function analyzeCode(source, execute = true) {
  const response = await fetch(`${API}/${execute ? 'execute' : 'analyze'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'No se pudo procesar el archivo.');
  return result;
}

export function downloadFile(name, text, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}