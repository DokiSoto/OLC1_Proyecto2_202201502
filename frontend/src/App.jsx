import React, { useRef, useState, useEffect } from 'react';
import { analyzeCode, downloadFile } from './services/api.js';
import DataTable from './components/DataTable.jsx';
import AstView from './components/AstView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const TABS_TOP = ['Errores', 'Tokens', 'Símbolos', 'AST', 'Infraestructura'];
const TABS_BOTTOM = ['Consola', 'Bitacora'];
const FILE_TYPES = [{ description: 'Código AutoInfra', accept: { 'text/plain': ['.infra'] } }];

export default function App() {
  const [source, setSource] = useState(''), [filename, setFilename] = useState('nuevo.infra');
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  
  const [tabTop, setTabTop] = useState('Errores');
  const [tabBottom, setTabBottom] = useState('Consola');
  
  const [notice, setNotice] = useState('');
  const handle = useRef(null), fallbackInput = useRef(null);

  // Lógica para arrastrar la barra divisoria
  const [isDragging, setIsDragging] = useState(false);
  const [bottomHeight, setBottomHeight] = useState(250); 
  const topRowRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      if (topRowRef.current) {
        const topRowRect = topRowRef.current.getBoundingClientRect();
        const newHeight = e.clientY - topRowRect.bottom + 8; 
        if (newHeight > 80) { 
          setBottomHeight(newHeight);
        }
      }
    };
    const handleMouseUp = () => { setIsDragging(false); };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  function edit(value) { 
    setSource(value); 
    setDirty(true); 
    setResult(null); 
    setNotice('Listo'); 
  }
  
  async function loadFile(file, fileHandle = null) {
    if (!file.name.toLowerCase().endsWith('.infra')) throw new Error('Selecciona un .infra.');
    const text = await file.text();
    setSource(text); setFilename(file.name); handle.current = fileHandle; setDirty(false);
    setResult(null); setNotice(`Archivo abierto: ${file.name}`);
  }
  
  async function openFile() {
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
        if (!name) throw new Error('no puede estar vacio');
        const complete = name.toLowerCase().endsWith('.infra') ? name : name + '.infra';
        downloadFile(complete, source); setFilename(complete); setDirty(false);
        setNotice('Descarga iniciada.');
      }
    } catch (error) { if (error.name !== 'AbortError') setNotice(error.message); }
  }
  
  function newFile() {
    setSource(''); 
    setFilename('nuevo.infra');
    handle.current = null; 
    setDirty(false); 
    setResult(null); 
    setNotice('');
  }
  
  async function run(execute) {
    if (busy) return;
    if (!source.trim()) { setNotice('no hay nada'); return; }
    
    setBusy(true);
    setNotice(execute ? 'Ejecutand' : 'Analizand');
    try {
      const data = await analyzeCode(source, execute);
      setResult(data);
      
      if (data.errors.length > 0) {
        setTabTop('Errores');
      } else {
        setTabTop('Infraestructura');
        setTabBottom(execute ? 'Consola' : 'Errores');
      }
      
      setNotice(data.success ? (execute ? 'Ejecución exitosa.' : 'Análisis exitoso.') : 'Proceso finalizado con errores.');
    } catch (error) {
      setResult(null);
      setNotice(`No se completó: ${error?.message || 'Error desconocido'}`);
    } finally {
      setBusy(false);
    }
  }

  const infra = result?.infrastructure;

  return (
    <div className="ide-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header className="ide-header">
        <div className="ide-logo">
          <span className="logo-icon"></span>  PROYECTO 2 AUTOINFRS <span className="logo-badge"></span>
        </div>
        <div className="ide-toolbar">
          <button disabled={busy} onClick={newFile}>Nuevo archivo</button>
          <button disabled={busy} onClick={openFile}>Abrir archivo</button>
          <button disabled={busy} onClick={() => saveFile(true)}>Guardar archivo</button>
        </div>
        <div className="ide-actions">
          <button className="btn-secondary" disabled={busy} onClick={() => run(false)}>Analizar</button>
          <button className="btn-primary" disabled={busy} onClick={() => run(true)}>
            {busy ? ' Procesando...' : 'Ejecutar'}
          </button>
        </div>
      </header>

      <div className="ide-workspace" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0px', overflow: 'hidden', padding: '12px' }}>
        
        {}
        <div 
          ref={topRowRef}
          className="ide-top-row" 
          style={{ display: 'flex', flex: 1, gap: '12px', overflow: 'hidden' }}
        >
          <div className="ide-panel editor-panel">
            <div className="panel-header">
              <div className="file-tab active">
                {filename} {dirty && <span className="dot-dirty"></span>}
              </div>
            </div>
            <div className="editor-container">
              <div className="line-numbers">
                {source.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea 
                id="source" spellCheck="false" value={source} disabled={busy} 
                onChange={event => edit(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Tab') {
                    event.preventDefault(); 
                    const element = event.currentTarget, start = element.selectionStart, end = element.selectionEnd;
                    edit(source.slice(0, start) + '    ' + source.slice(end));
                    requestAnimationFrame(() => { element.selectionStart = element.selectionEnd = start + 4; });
                  }
                }} 
              />
            </div>
            <div className="status-bar"></div>
          </div>

          <div className="ide-panel results-panel">
            <div className="panel-header tabs-header">
              {TABS_TOP.map(name => (
                <button key={name} className={`tab-btn ${tabTop === name ? 'active' : ''}`} onClick={() => setTabTop(name)}>
                  {name}
                </button>
              ))}
            </div>
            
            <div className="result-content">
              <ErrorBoundary resetKey={result}>
                {tabTop === 'Errores' && <DataTable rows={result?.errors} columns={[['type', 'Tipo'], ['code', 'Código'], ['description', 'Descripción'], ['line', 'Línea'], ['column', 'Columna']]} />}
                {tabTop === 'Tokens' && <DataTable rows={result?.tokens} columns={[['lexeme', 'Lexema'], ['type', 'Token'], ['line', 'Línea'], ['column', 'Columna']]} />}
                {tabTop === 'Símbolos' && <DataTable rows={result?.symbols} columns={[['identifier', 'Identificador'], ['category', 'Categoría'], ['type', 'Tipo'], ['scope', 'Ámbito'], ['value', 'Valor']]} />}
                {tabTop === 'AST' && <AstView key={source} tree={result?.ast} />}
                {tabTop === 'Infraestructura' && (
                  <div className="infra-grid">
                    {[['Servidores', infra?.servers], ['Servicios', infra?.services], ['Bases de datos', infra?.databases], ['Conexiones', infra?.connections]].map(([label, rows]) => (
                      <div key={label} className="infra-card">
                        <h3>{label}</h3>
                        <DataTable rows={rows} />
                      </div>
                    ))}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {}
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
          style={{ 
            height: '10px', 
            cursor: 'row-resize', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexShrink: 0,
            margin: '4px 0'
          }}
        >
          <div style={{ 
            width: '60px', 
            height: '6px', 
            background: isDragging ? '#2563eb' : '#cbd5e1', 
            borderRadius: '3px',
            transition: 'background 0.2s'
          }}></div>
        </div>

        {}
        <div 
          className="ide-bottom-row" 
          style={{ 
            height: `${bottomHeight}px`, 
            display: 'flex', 
            flexShrink: 0, 
            overflow: 'hidden'
          }}
        >
          <div className="ide-panel bottom-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header tabs-header" style={{ borderBottom: '1px solid #e5e7eb', display: 'flex' }}>
              {TABS_BOTTOM.map(name => (
                <button key={name} className={`tab-btn ${tabBottom === name ? 'active' : ''}`} onClick={() => setTabBottom(name)}>
                  {name}
                </button>
              ))}
              <div style={{ flex: 1 }}></div>
              <span className={`status-indicator ${result ? (result.success ? 'success' : 'error') : ''}`} style={{ paddingRight: '16px' }}>
                {notice}
              </span>
            </div>
            
            <div className="result-content" style={{ padding: '10px', flex: 1, overflow: 'auto' }}>
              <ErrorBoundary resetKey={result}>
                {tabBottom === 'Consola' && (
                  <div className="console-box">
                    {result?.console.length ? result.console.map((line, i) => <div key={i} className="console-line">{line}</div>) : <span className="text-muted">La salida de print aparecerá aquí.</span>}
                  </div>
                )}
                {tabBottom === 'Bitácora' && (
                  <div className="console-box log-box">
                    {result?.log.length ? result.log.map((line, i) => <div key={i} className="console-line log-line">{line}</div>) : <span className="text-muted">No hay acciones registradas.</span>}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}