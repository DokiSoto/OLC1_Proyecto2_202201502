const API = 'http://127.0.0.1:8080/api';

export function validateResult(result) {
  if (!result || typeof result !== 'object' || typeof result.success !== 'boolean')
    throw new Error('Respuesta inválida del backend. Reinicia el servidor actualizado.');
  for (const key of ['console', 'errors', 'tokens', 'symbols', 'log']) {
    if (!Array.isArray(result[key])) throw new Error(`Respuesta incompleta: falta la lista '${key}'.`);
  }
  if (!result.infrastructure || ['servers', 'services', 'databases', 'connections']
    .some(key => !Array.isArray(result.infrastructure[key])))
    throw new Error('Respuesta incompleta.');
  if (typeof result.durationMs !== 'number') throw new Error('Respuesta inválida');
  return result;
}

export async function analyzeCode(source, execute = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${API}/${execute ? 'execute' : 'analyze'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }), signal: controller.signal,
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch { throw new Error(`El backend no devolvió JSON (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(result.message ?? `Error HTTP ${response.status}.`);
    return validateResult(result);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('El backend tuvo problemas');
    throw error;
  } finally { clearTimeout(timer); }
}

export function downloadFile(name, text, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}