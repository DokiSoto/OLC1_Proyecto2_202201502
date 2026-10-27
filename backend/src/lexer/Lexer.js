const KEYWORDS = new Set([
  'int', 'float', 'string', 'bool', 'server', 'service', 'database',
  'if', 'else', 'while', 'for', 'break', 'continue', 'return',
  'function', 'task', 'main', 'run', 'true', 'false', 'void',
]);
const PAIRS = new Set(['==', '!=', '>=', '<=', '&&', '||']);
const SINGLE = new Set('+-*/%><!=;,.(){}[]');

export class Lexer {
  constructor(source) {
    this.source = source.replace(/\r\n?/g, '\n');
    this.index = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];
  }
  peek(offset = 0) { return this.source[this.index + offset] ?? ''; }
  advance() {
    const ch = this.source[this.index++];
    if (ch === '\n') { this.line++; this.column = 1; }
    else this.column++;
    return ch;
  }
  add(type, start, line, column, value) {
    const lexeme = this.source.slice(start, this.index);
    this.tokens.push({ type, lexeme, value: value ?? lexeme, line, column });
  }
  error(description, line, column, code = 'LEX-001', lexeme = '') {
    this.errors.push({ type: 'Léxico', code, description, lexeme, line, column });
  }
  scan() {
    while (this.index < this.source.length) {
      const start = this.index, line = this.line, column = this.column;
      const ch = this.advance();
      if (/\s/.test(ch)) continue;
      if (ch === '/' && this.peek() === '/') {
        while (this.peek() && this.peek() !== '\n') this.advance();
        continue;
      }
      if (ch === '/' && this.peek() === '*') {
        this.advance();
        while (this.peek() && !(this.peek() === '*' && this.peek(1) === '/')) this.advance();
        if (!this.peek()) this.error('Comentario multilínea sin cierre.', line, column, 'LEX-003', '/*');
        else { this.advance(); this.advance(); }
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        while (this.peek() && /[A-Za-z0-9_]/.test(this.peek())) this.advance();
        const word = this.source.slice(start, this.index);
        this.add(KEYWORDS.has(word) ? word : 'IDENTIFIER', start, line, column);
        continue;
      }
      if (/[0-9]/.test(ch)) {
        while (this.peek() && /[0-9]/.test(this.peek())) this.advance();
        let type = 'INT';
        if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
          type = 'FLOAT'; this.advance();
          while (this.peek() && /[0-9]/.test(this.peek())) this.advance();
        }
        this.add(type, start, line, column, Number(this.source.slice(start, this.index)));
        continue;
      }
      if (ch === '"') {
        let value = '', closed = false;
        const escapes = { n: '\n', t: '\t', '"': '"', '\\': '\\' };
        while (this.peek() && this.peek() !== '\n') {
          const escapeLine = this.line, escapeColumn = this.column;
          const next = this.advance();
          if (next === '"') { closed = true; break; }
          if (next === '\\') {
            if (!this.peek() || this.peek() === '\n') break;
            const escaped = this.advance();
            if (!Object.hasOwn(escapes, escaped))
              this.error('Escape no reconocido: \\' + escaped, escapeLine, escapeColumn, 'LEX-004', '\\' + escaped);
            value += escapes[escaped] ?? escaped;
          } else value += next;
        }
        if (!closed) this.error('Cadena sin cierre.', line, column, 'LEX-002', this.source.slice(start, this.index));
        else this.add('STRING', start, line, column, value);
        continue;
      }
      if (PAIRS.has(ch + this.peek())) {
        this.advance(); this.add(this.source.slice(start, this.index), start, line, column);
      } else if (SINGLE.has(ch)) this.add(ch, start, line, column);
      else this.error(`Carácter no reconocido: ${ch}`, line, column, 'LEX-001', ch);
    }
    this.tokens.push({ type: 'EOF', lexeme: '', value: null, line: this.line, column: this.column });
    return { tokens: this.tokens, errors: this.errors };
  }
}