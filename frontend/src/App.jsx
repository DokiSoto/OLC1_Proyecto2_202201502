import React, { useRef, useState } from 'react';
import { analyzeCode, downloadFile } from './services/api.js';
import DataTable from './components/DataTable.jsx';
import AstView from './components/AstView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const EXAMPLE = `server backend {
    cpu = 4;
    memory = 8;
    disk = 100;
    os = "ubuntu";
}
database postgres {
    engine = "postgresql";
    version = "16";
    port = 5432;
}
service api {
    port = 8080;
    replicas = 2;
    dependsOn = [postgres];
}
string[] packages = ["docker", "git"];
function ready(server s, database db) bool {
    return s.status == "running" && db.status == "running" && s.memory >= 8;
}
task production {
    start(postgres);
    start(backend);
    for (int i = 0; i < length(packages); i = i + 1) {
        install(backend, packages[i]);
    }
    if (ready(backend, postgres)) {
        deploy(backend, api);
        scale(api, 3);
    }
    print("API disponible en puerto " + api.port);
    print("Servidor: " + api.host.os);
    print("Réplicas: " + api.replicas);
}
main {
    run production;
}
`;
const TABS = ['Consola', 'Errores', 'Tokens', 'Símbolos', 'AST', 'Infraestructura', 'Bitácora'];
const FILE_TYPES = [{ description: 'Código AutoInfra', accept: { 'text/plain': ['.infra'] } }];

export default function App() {
  const [source, setSource] = useState(EXAMPLE), [filename, setFilename] = useState('produccion.infra');
  const [dirty, setDirty] = useState(true), [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null), [tab, setTab] = useState('Consola');
  const [notice, setNotice] = useState('Ejemplo cargado. Guarda el archivo y presiona Ejecutar.');
  const handle = useRef(null), fallbackInput = useRef(null);

  function edit(value) { setSource(value); setDirty(true); setResult(null); setNotice('Código modificado. Ejecuta para actualizar reportes.'); }
  function mayReplace() { return !dirty || window.confirm('Hay cambios sin guardar. ¿Deseas reemplazar el contenido?'); }
  async function loadFile(file, fileHandle = null) {
    if (!file.name.toLowerCase().endsWith('.infra')) throw new Error('Selecciona un archivo con extensión .infra.');
    const text = await file.text();
    setSource(text); setFilename(file.name); handle.current = fileHandle; setDirty(false);
    setResult(null); setNotice(`Archivo abierto: ${file.name}`);
  }
  async function openFile() {
    if (!mayReplace()) return;
    if (!window.showOpenFilePicker) { fallbackInput.current.click(); return; }
    try {
      const [selected] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
      await loadFile(await selected.getFile(), selected);
    } catch (error) { if (error.name !== 'AbortError') setNotice(error.message); }
  }
  async function saveFile(saveAs = false) {
    try {
      if (window.showSaveFilePicker) {
        let target = handle.current;
        if (saveAs || !target) target = await window.showSaveFilePicker({ suggestedName: filename, types: FILE_TYPES });
        if (!target.name.toLowerCase().endsWith('.infra')) throw new Error('El nombre debe terminar en .infra.');
        const writable = await target.createWritable(); await writable.write(source); await writable.close();
        handle.current = target; setFilename(target.name); setDirty(false); setNotice(`Guardado: ${target.name}`);
      } else {
        const requested = saveAs ? window.prompt('Nombre del archivo:', filename) : filename;
        if (requested === null) return;
        const name = requested.trim();
        if (!name) throw new Error('Escribe un nombre para el archivo.');
        const complete = name.toLowerCase().endsWith('.infra') ? name : name + '.infra';
        downloadFile(complete, source); setFilename(complete); setDirty(false);
        setNotice('Descarga iniciada. En este navegador Guardar descarga una copia; verifica tu carpeta de descargas.');
      }
    } catch (error) { if (error.name !== 'AbortError') setNotice(error.message); }
  }
  function newFile() {
    if (!mayReplace()) return;
    setSource('main {\n    print("Hola AutoInfra");\n}\n'); setFilename('nuevo.infra');
    handle.current = null; setDirty(true); setResult(null); setNotice('Archivo nuevo sin guardar.');
  }
  async function run(execute) {
    setBusy(true); setResult(null); setNotice(execute ? 'Ejecutando…' : 'Analizando…');
    try {
      const data = await analyzeCode(source, execute); setResult(data);
      setTab(data.errors.length ? 'Errores' : 'Consola');
      setNotice(data.success ? execute ? 'Ejecución finalizada correctamente.' : 'Análisis finalizado correctamente; no se ejecutaron instrucciones.' : 'Proceso finalizado con errores.');
    } catch (error) { setResult(null); setNotice(`No se completó la solicitud: ${error.message}. Comprueba el backend.`); }
    finally { setBusy(false); }
  }
  const infra = result?.infrastructure;
  return <main className="app-shell">
    <header className="masthead"><div><span className="eyebrow">OLC1 · PROYECTO 2</span>
      <h1>AutoInfra<span className="brand-dot">.</span></h1><p>Describe. Ejecuta. Observa tu infraestructura.</p></div>
      <div className="local-badge">ENTORNO SIMULADO <span>LOCAL</span></div></header>
    <section className="toolbar" aria-label="Acciones de archivo">
      <button disabled={busy} onClick={newFile}>Nuevo</button><button disabled={busy} onClick={openFile}>Abrir</button>
      <button disabled={busy} onClick={() => saveFile(false)}>Guardar</button><button disabled={busy} onClick={() => saveFile(true)}>Guardar como</button>
      <span className="toolbar-spacer" /><button disabled={busy} onClick={() => run(false)}>Analizar</button>
      <button className="primary" disabled={busy} onClick={() => run(true)}>{busy ? 'Procesando…' : '▶ Ejecutar'}</button>
      <button disabled={busy} onClick={() => { setResult(null); setNotice('Resultados y reportes limpiados.'); }}>Limpiar resultados</button>
    </section>
    <input hidden ref={fallbackInput} type="file" accept=".infra" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) try { await loadFile(file); } catch (error) { setNotice(error.message); }
    }} />
    <div className={`status ${result ? result.success ? 'success' : 'failure' : ''}`} role="status">
      <span>{notice}</span>{result && <span>{result.durationMs} ms · {result.tokens.length} tokens · {result.errors.length} errores</span>}
    </div>
    <div className="workspace">
      <section className="panel editor-panel"><div className="panel-title"><h2>{filename}{dirty ? ' •' : ''}</h2><span>AutoInfra</span></div>
        <label className="sr-only" htmlFor="source">Código fuente AutoInfra</label>
        <textarea id="source" spellCheck="false" value={source} disabled={busy} onChange={event => edit(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Tab') {
              event.preventDefault(); const element = event.currentTarget, start = element.selectionStart, end = element.selectionEnd;
              edit(source.slice(0, start) + '    ' + source.slice(end));
              requestAnimationFrame(() => { element.selectionStart = element.selectionEnd = start + 4; });
            }
          }} />
        <div className="editor-footer">{source.split('\n').length} líneas · UTF-8 · {dirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}</div>
      </section>
      <section className="panel results-panel"><div className="panel-title"><h2>Resultados</h2>
        <button disabled={!result || busy} onClick={() => downloadFile('reporte-autoinfra.json', JSON.stringify(result, null, 2), 'application/json')}>Exportar JSON</button></div>
        <div className="tabs" role="tablist">{TABS.map(name => <button role="tab" aria-selected={tab === name}
          key={name} onClick={() => setTab(name)} className={tab === name ? 'active' : ''}>{name}</button>)}</div>
        <div className="result-body" role="tabpanel">
          <ErrorBoundary resetKey={result}>
          {tab === 'Consola' && <pre className="console">{result?.console.join('\n') || 'La salida de print aparecerá aquí.'}</pre>}
          {tab === 'Bitácora' && <pre className="console">{result?.log.join('\n') || 'Las acciones de infraestructura aparecerán aquí.'}</pre>}
          {tab === 'Errores' && <DataTable rows={result?.errors} columns={[
            ['type', 'Tipo'], ['code', 'Código'], ['description', 'Descripción'], ['line', 'Línea'], ['column', 'Columna']]} />}
          {tab === 'Tokens' && <DataTable rows={result?.tokens} columns={[
            ['lexeme', 'Lexema'], ['type', 'Token'], ['line', 'Línea'], ['column', 'Columna']]} />}
          {tab === 'Símbolos' && <DataTable rows={result?.symbols} columns={[
            ['identifier', 'Identificador'], ['category', 'Categoría'], ['type', 'Tipo'], ['scope', 'Ámbito'], ['value', 'Valor']]} />}
          {tab === 'AST' && <AstView key={source} tree={result?.ast} />}
          {tab === 'Infraestructura' && <div className="infra-groups">
            {[['Servidores', infra?.servers], ['Servicios', infra?.services], ['Bases de datos', infra?.databases], ['Conexiones', infra?.connections]]
              .map(([label, rows]) => <section key={label}><h3>{label}</h3><DataTable rows={rows} /></section>)}
          </div>}
          </ErrorBoundary>
        </div>
      </section>
    </div>
    <footer>AutoInfra · Cada ejecución comienza con un entorno nuevo.</footer>
  </main>;
}