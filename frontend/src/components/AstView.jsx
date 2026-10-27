import React, { useRef } from 'react';

export default function AstView({ tree }) {
  const containerRef = useRef(null);

  if (!tree) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#000' }}>El AST aparecerá aquí al analizar el código.</div>;
  }

  const downloadSVG = () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AST_AutoInfra.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- CÁLCULO DE POSICIONES DEL ÁRBOL ---
  const nodeWidth = 160;
  const nodeSpacingX = 40; // Espacio horizontal entre nodos
  const nodeSpacingY = 80; // Espacio vertical entre niveles
  
  // Variables globales para el dibujo
  let currentX = 0;
  const nodesToDraw = [];
  const linesToDraw = [];

  // Función recursiva para calcular las posiciones X, Y
  const calculateLayout = (node, depth = 0) => {
    if (!node) return { x: 0, y: 0 };

    const y = depth * nodeSpacingY + 50;
    let x = 0;

    if (node.children && node.children.length > 0) {
      // Si tiene hijos, calculamos la posición de todos ellos primero
      const childPositions = node.children.map(child => calculateLayout(child, depth + 1));
      
      // El nodo padre se centra respecto a su primer y último hijo
      const firstChildX = childPositions[0].x;
      const lastChildX = childPositions[childPositions.length - 1].x;
      x = (firstChildX + lastChildX) / 2;

      // Creamos las líneas que conectan al padre con los hijos
      childPositions.forEach((childPos, index) => {
        linesToDraw.push({
          x1: x + nodeWidth / 2,
          y1: y + 60, // Altura aproximada del nodo
          x2: childPos.x + nodeWidth / 2,
          y2: childPos.y,
          key: `line-${depth}-${index}-${x}-${childPos.x}`
        });
      });

    } else {
      // Si es una hoja, le asignamos el espacio actual y avanzamos
      x = currentX;
      currentX += nodeWidth + nodeSpacingX;
    }

    // Guardamos el nodo para dibujarlo después
    nodesToDraw.push({ node, x, y, depth });

    return { x, y };
  };

  // Ejecutamos el cálculo empezando por la raíz
  calculateLayout(tree, 0);

  // Calculamos las dimensiones totales del SVG
  const maxWidth = currentX + 100;
  const maxHeight = Math.max(...nodesToDraw.map(n => n.y)) + 150;

  const renderNode = (item, index) => {
    const { node, x, y } = item;
    const labelParts = node.label ? node.label.split('\n') : ['Nodo'];
    const title = labelParts[0];
    const details = labelParts.slice(1);
    
    // Calcular altura del cuadro según las líneas de texto
    const textLines = [title, ...details, `L:${node.line} C:${node.column}`];
    const boxHeight = 20 + (textLines.length * 14);

    return (
      <g key={index}>
        <rect 
          x={x} 
          y={y} 
          width={nodeWidth} 
          height={boxHeight} 
          fill="#fff" 
          stroke="#000" 
          strokeWidth="1.5" 
          rx="4"
        />
        {textLines.map((text, i) => (
          <text 
            key={i} 
            x={x + nodeWidth / 2} 
            y={y + 18 + (i * 14)} 
            textAnchor="middle" 
            fill="#000" 
            fontSize={i === 0 ? "12" : "11"}
            fontWeight={i === 0 ? "bold" : "normal"}
            fontFamily="sans-serif"
          >
            {text}
          </text>
        ))}
      </g>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#ffffff', overflow: 'auto' }}>
      
      <button 
        onClick={downloadSVG}
        style={{
          position: 'absolute',
          top: '10px',
          right: '20px',
          padding: '8px 16px',
          background: '#000',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          zIndex: 10,
          fontWeight: 'bold',
          borderRadius: '4px'
        }}
      >
        Descargar AST
      </button>

      <div ref={containerRef} style={{ padding: '20px', display: 'inline-block', minWidth: '100%' }}>
        <svg 
          width={maxWidth} 
          height={maxHeight}
        >
          {/* Dibujamos primero las líneas para que queden detrás de los cuadros */}
          {linesToDraw.map(line => (
            <path 
              key={line.key}
              d={`M ${line.x1} ${line.y1} L ${line.x1} ${line.y1 + 20} L ${line.x2} ${line.y1 + 20} L ${line.x2} ${line.y2}`}
              fill="none" 
              stroke="#000" 
              strokeWidth="1" 
            />
          ))}
          
          {}
          {nodesToDraw.map((item, i) => renderNode(item, i))}
        </svg>
      </div>
    </div>
  );
}