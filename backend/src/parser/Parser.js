import * as N from '../ast/Nodes.js';

//Creacion de la clase Parser
const TYPES = new Set(['int', 'float', 'string', 'bool', 'server', 'service', 'database']);
const RESOURCES = new Set(['server', 'service', 'database']);
const LEVELS = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];

//Creacion de la clase ParseFailure
class ParseFailure extends Error {}

export class Parser {
  constructor(tokens) { this.tokens = tokens; this.index = 0; this.errors = []; }
  peek(offset = 0) { return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)]; }
  is(type) { return this.peek().type === type; }
  advance() { const token = this.peek(); if (!this.is('EOF')) this.index++; return token; }
  match(type) { if (!this.is(type)) return false; this.advance(); return true; }
  fail(message, token = this.peek()) {
    this.errors.push({ type: 'Sintáctico', code: 'SYN-001', description: message, line: token.line, column: token.column });
    throw new ParseFailure(message);
  }
  expect(type) {
    if (!this.is(type)) this.fail(`Se esperaba '${type}', se encontró '${this.peek().lexeme || 'fin de archivo'}'.`);
    return this.advance();
  }
  synchronize(start) {
    if (this.index === start && !this.is('EOF') && !this.is('}')) this.advance();
    while (!this.is('EOF') && !this.is('}')) {
      if (this.match(';')) return;
      if (TYPES.has(this.peek().type) || ['main', 'function', 'task', 'if', 'while', 'for', 'return', 'run', 'break', 'continue', 'IDENTIFIER', '{'].includes(this.peek().type)) return;
      this.advance();
    }
  }
  
  parse() {
    const declarations = []; let main = null;
    while (!this.is('EOF')) {
      const start = this.index;
      try {
        if (this.match('main')) {
          const block = this.block();
          if (main) this.fail('Debe existir exactamente un bloque main.', block);
          main = block;
        } else {
          if (main) this.fail('Las declaraciones globales deben estar antes de main.');
          declarations.push(this.declaration());
        }
      } catch (error) {
        if (!(error instanceof ParseFailure)) throw error;
        this.synchronize(start);
        if (this.is('}')) this.advance();
      }
    }

    if (!main) this.errors.push({ type: 'Sintáctico', code: 'SYN-002', description: 'Falta el bloque main.', line: 1, column: 1 });
    return { ast: main ? new N.Program(declarations, main, this.tokens[0]) : null, errors: this.errors };
  }
  type(allowVoid = false) {
    const token = this.advance();
    if (!TYPES.has(token.type) && !(allowVoid && token.type === 'void')) this.fail('Se esperaba un tipo.', token);
    let type = token.type;
    if (type !== 'void' && this.match('[')) { this.expect(']'); type += '[]'; }
    return type;
  }

  //Creacion de la funcion declaration
  declaration() {
    const loc = this.peek();
    if (this.match('function')) {
      const name = this.expect('IDENTIFIER').lexeme;
      this.expect('('); const parameters = [];
      if (!this.is(')')) do {
        const type = this.type(), parameter = this.expect('IDENTIFIER').lexeme;
        parameters.push({ type, name: parameter });
      } while (this.match(','));
      this.expect(')');
      const returnType = this.is('{') ? 'void' : this.type(true);
      return new N.FunctionDeclaration(name, parameters, returnType, this.block(), loc);
    }
    if (this.match('task')) {
      const name = this.expect('IDENTIFIER').lexeme;
      return new N.TaskDeclaration(name, this.block(), loc);
    }
    if (RESOURCES.has(this.peek().type) && this.peek(1).type === 'IDENTIFIER' && this.peek(2).type === '{') {
      const type = this.advance().type, name = this.advance().lexeme;
      this.expect('{'); const properties = [];
      while (!this.is('}') && !this.is('EOF')) {
        const property = this.expect('IDENTIFIER'); this.expect('=');
        properties.push(new N.ResourceProperty(property.lexeme, this.expression(), property)); this.expect(';');
      }
      this.expect('}');
      return new N.ResourceDeclaration(type, name, properties, loc);
    }
    if (TYPES.has(this.peek().type)) return this.variable(true);
    this.fail('Se esperaba una declaración global o main.');
  }
  //Creacion de la funcion variable
  variable(semicolon) {
    const loc = this.peek(), type = this.type(), name = this.expect('IDENTIFIER').lexeme;
    const initializer = this.match('=') ? this.expression() : null;
    if (semicolon) this.expect(';');
    return new N.VariableDeclaration(type, name, initializer, loc);
  }

  block() {
    const loc = this.expect('{'), instructions = [];
    while (!this.is('}') && !this.is('EOF')) {
      const start = this.index;
      try { instructions.push(this.statement()); }
      catch (error) {
        if (!(error instanceof ParseFailure)) throw error;
        this.synchronize(start);
      }
    }
    this.expect('}'); return new N.Block(instructions, loc);
  }
  statement() {
    const loc = this.peek();
    if (this.is('{')) return this.block();
    if (TYPES.has(loc.type)) return this.variable(true);
    if (this.match('if')) {
      this.expect('('); const condition = this.expression(); this.expect(')');
      const thenBranch = this.block();
      const elseBranch = this.match('else') ? (this.is('if') ? this.statement() : this.block()) : null;
      return new N.IfInstruction(condition, thenBranch, elseBranch, loc);
    }
    if (this.match('while')) {
      this.expect('('); const condition = this.expression(); this.expect(')');
      return new N.WhileInstruction(condition, this.block(), loc);
    }
    if (this.match('for')) {
      this.expect('(');
      const initializer = this.is(';') ? null : TYPES.has(this.peek().type) ? this.variable(false) : this.simple(false);
      this.expect(';'); const condition = this.is(';') ? null : this.expression(); this.expect(';');
      const update = this.is(')') ? null : this.simple(false); this.expect(')');
      return new N.ForInstruction(initializer, condition, update, this.block(), loc);
    }
    if (this.match('return')) {
      const value = this.is(';') ? null : this.expression(); this.expect(';');
      return new N.ReturnInstruction(value, loc);
    }
    if (this.match('break')) { this.expect(';'); return new N.BreakInstruction(loc); }
    if (this.match('continue')) { this.expect(';'); return new N.ContinueInstruction(loc); }
    if (this.match('run')) {
      const name = this.expect('IDENTIFIER').lexeme; this.expect(';'); return new N.RunInstruction(name, loc);
    }
    return this.simple(true);
  }
  simple(semicolon) {
    const loc = this.peek(), expression = this.expression(); let node;
    if (this.match('=')) {
      if (!(expression instanceof N.IdentifierExpression || expression instanceof N.IndexExpression || expression instanceof N.PropertyAccessExpression))
        this.fail('Destino de asignación inválido.', loc);
      node = new N.Assignment(expression, this.expression(), loc);
    } else node = new N.ExpressionInstruction(expression, loc);
    if (semicolon) this.expect(';'); return node;
  }
  expression(level = 0) {
    if (level === LEVELS.length) return this.unary();
    let left = this.expression(level + 1);
    while (LEVELS[level].includes(this.peek().type)) {
      const operator = this.advance();
      left = new N.BinaryExpression(left, operator.type, this.expression(level + 1), operator);
    }
    return left;
  }
  unary() {
    if (this.is('!') || this.is('-')) { const op = this.advance(); return new N.UnaryExpression(op.type, this.unary(), op); }
    let node = this.primary();
    while (true) {
      const loc = this.peek();
      if (this.match('(')) {
        const args = [];
        if (!this.is(')')) do { args.push(this.expression()); } while (this.match(','));
        this.expect(')'); node = new N.CallExpression(node, args, loc);
      } else if (this.match('.')) node = new N.PropertyAccessExpression(node, this.expect('IDENTIFIER').lexeme, loc);
      else if (this.match('[')) { const index = this.expression(); this.expect(']'); node = new N.IndexExpression(node, index, loc); }
      else break;
    }
    return node;
  }
  primary() {
    const token = this.peek();
    if (!['INT', 'FLOAT', 'STRING', 'true', 'false', 'IDENTIFIER', '(', '['].includes(token.type))
      this.fail('Se esperaba una expresión.', token);
    this.advance();
    if (['INT', 'FLOAT', 'STRING'].includes(token.type)) return new N.LiteralExpression(token.value, token.type.toLowerCase(), token);
    if (token.type === 'true' || token.type === 'false') return new N.LiteralExpression(token.type === 'true', 'bool', token);
    if (token.type === 'IDENTIFIER') return new N.IdentifierExpression(token.lexeme, token);
    if (token.type === '(') { const node = this.expression(); this.expect(')'); return node; }
    if (token.type === '[') {
      const items = [];
      if (!this.is(']')) do { items.push(this.expression()); } while (this.match(','));
      this.expect(']'); return new N.ArrayExpression(items, token);
    }
    this.fail('Se esperaba una expresión.', token);
  }
}