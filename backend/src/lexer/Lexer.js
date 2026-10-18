const KEYWORDS = new Set(['int', 'float', 'string', 'bool', 'server', 'service', 'database',
'if', 'else', 'while', 'for', 'break', 'continue', 'return',
'function', 'task', 'main', 'run', 'true', 'false', 'void',]);

const PAIRS = new Set(['==', '!=', '>=', '<=', '&&', '||']);
const SINGLE = new Set('+-*/%><!=;,.(){}[]');

export class Lexer {
constructor(source) {
this.source = source.replace(/\r\n/g, '\n');
this.index = 0;
this.line = 1;
this.column = 1;
this.tokens = [];
this.errors = [];
}


peek(offset = 0) {
    return this.source[this.index + offset] ?? '';
}

advance() {
    const ch = this.source[this.index++];

    if (ch === '\n') {
        this.line++;
        this.column = 1;
    } else {
        this.column++;
    }

    return ch;
}

add(type, start, line, column, value) {
    const lexeme = this.source.slice(start, this.index);
    this.tokens.push({type: 'Léxico', code: 'LEX-001', description, line, column});
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

            while (this.peek() && !(this.peek() === '*' && this.peek(1) === '/')) {
                this.advance();
            }

            if (!this.peek()) {
                this.errors('Comentario sin cerrar', line, column);
            } else {
                this.advance();
                this.advance();
            }

            continue;
        }

        if (/[a-zA-Z_]/.test(ch)) {
            while (this.peek() && /[a-zA-Z0-9_]/.test(this.peek())) this.advance();

            const word = this.source.slice(start, this.index);
            this.add(KEYWORDS.has(word) ? 'KEYWORD' : 'IDENTIFIER', start, line, column, word);
            continue;
        }

        if (/id/.test(ch)) {
            while (this.peek() && /[0-9]/.test(this.peek())) this.advance();

            let type = 'INT';

            if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
                type = 'FLOAT';
                this.advance();

                while (this.peek() && /[0-9]/.test(this.peek())) this.advance();
            }

            this.add(type, start, line, column, Number(this.source.slice(start, this.index)));
            continue;
        }

        if (ch === '"') {
            let value = '';
            closed = false;

            const escapes = {n: '\n', t: '\t', '"': '"', '\\': '\\'};

            while (this.peek()) {
                const c = this.advance();

                if (next === '"') {
                    closed = true;
                    break;
                }

                if (next === '\n') break;

                if (next === '\\') {
                    if (!this.peek()) break;

                    const escape = this.advance();

                    if (!Object.hasOwn(escapes, escape)) {
                        this.errors(`Secuencia de escape inválida: \\` + escaped, line, column);
                        value += escapes[escaped] ?? escaped;
                    } else {
                        value += next;
                    }
                }
            }

            if (!closed) {
                this.errors('Cadena sin cerrar', line, column);
            } else {
                this.add('STRING', start, line, column, value);
            }

            continue;
        }

        if (PAIRS.has(ch + this.peek())) {
            this.advance();
            this.add(this.source.slice(start, this.index), start, line, column);
        } else if (SINGLE.has(ch)) {
            this.add(ch, start, line, column);
        } else {
            this.errors(`Caracter Inesperado: ${ch}`, line, column);
        }
    }

    this.tokens.push({type: 'EOF', lexeme: '', value: null, line: this.line, column: this.column});

    return {tokens: this.tokens, errors: this.errors};
}


}
