import { RuntimeError, printable } 
from '../environment/Environment.js';

export const NORMAL = Object.freeze({ kind: 'normal' });
const signal = (kind, value = null) => ({ kind, value });
const defaults = type => type.endsWith('[]') ? [] : ({ int: 0, float: 0, string: '', bool: false }[type] ?? null);

export class Node {

    constructor(location = {}) { 
        this.line = location.line ?? 1; 
        this.column = location.column ?? 1; 
        

    }
    toTree() {
    const children = [], details = [];
    for (const [key, value] of Object.entries(this)) {
      if (key === 'line' || key === 'column') continue;
      if (value instanceof Node) children.push({ label: key, children: [value.toTree()] });
      else if (Array.isArray(value)) {
    children.push({ label: key, children: value.map(item => item instanceof Node
    ? item.toTree() : { label: JSON.stringify(item), children: [] }) });
      } else if (value !== null && typeof value !== 'object') details.push(`${key}: ${value}`);
    }
    return { label: this.constructor.name + (details.length ? '\n' + details.join('\n') : ''),
          line: this.line, column: this.column, children };
  }
}
export class Expression extends Node {

  evaluate() { 
    throw new Error('Falta implementar evaluate().'); 
}

}
export class Instruction extends Node {

  execute() { 
    throw new Error('Falta implementar execute().'); 
}

}
export class LiteralExpression extends Expression {
  constructor(value, type, loc) { 
    super(loc); this.value = value; this.type = type; 
}
  evaluate() { 
    return this.value; 
}
}

export class IdentifierExpression extends Expression {
  constructor(name, loc) { 
    super(loc); this.name = name; 
}
  evaluate(env) { 
    return env.get(this.name, this); 
}
  assign(env, value) { 
    return env.set(this.name, value, this); 
}
}

export class ArrayExpression extends Expression {
  constructor(items, loc) { 
    super(loc); this.items = items; 
}
  evaluate(env) { 
    
    return this.items.map(item => item.evaluate(env));
 }
}

export class UnaryExpression extends Expression {
  constructor(operator, operand, loc) {
     super(loc); this.operator = operator; this.operand = operand; 
    }
  evaluate(env) { 
    const value = this.operand.evaluate(env); return this.operator === '!' ? !value : -value; 
}
}

export class BinaryExpression extends Expression {

  constructor(left, operator, right, loc) { super(loc); Object.assign(this, { left, operator, right }); }
  evaluate(env) {

    const left = this.left.evaluate(env);
    if (this.operator === '&&') return Boolean(left) && Boolean(this.right.evaluate(env));
    if (this.operator === '||') return Boolean(left) || Boolean(this.right.evaluate(env));
    const right = this.right.evaluate(env);
    switch (this.operator) {
      case '+': return typeof left === 'string' || typeof right === 'string'
        ? printable(left) + printable(right) : left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '%': return left % right;
      case '==': return left === right;
      case '!=': return left !== right;

      case '>': return left > right;
      case '>=': return left >= right;
      case '<': return left < right;
      case '<=': return left <= right;
      default: throw new RuntimeError('Operador desconocido.', this);
    }
  }
}
export class PropertyAccessExpression extends Expression {
  constructor(object, property, loc) { 
    super(loc); this.object = object; this.property = property; }
  evaluate(env) {

    const resource = this.object.evaluate(env);
    if (!resource?.__resource || !Object.hasOwn(resource.props, this.property))
      throw new RuntimeError(`Propiedad no disponible: ${this.property}.`, this);
    return resource.props[this.property];
  }
  assign() { 
    throw new RuntimeError('Las propiedades de recursos se modifican mediante acciones nativas.', this); 
}
}
export class IndexExpression extends Expression {
  constructor(object, index, loc) { 
    super(loc); this.object = object; this.index = index; }
  reference(env) {
    const array = this.object.evaluate(env), index = this.index.evaluate(env);
    if (!Array.isArray(array) || !Number.isInteger(index) || index < 0 || index >= array.length)
      throw new RuntimeError('Índice de arreglo fuera de rango o inválido.', this);
    return { array, index };
  }
  evaluate(env) { 
    const { array, index } = this.reference(env); return array[index];
 }
  assign(env, value) {
    let base = this.object;
    while (base instanceof IndexExpression) base = base.object;
    if (base instanceof PropertyAccessExpression)
      throw new RuntimeError('No se modifica directamente una colección de un recurso.', this);
    const { array, index } = this.reference(env); array[index] = value; return value;
  }
}
export class CallExpression extends Expression {
  constructor(callee, args, loc) { super(loc); this.callee = callee; this.args = args; }
  evaluate(env) {
    const args = this.args.map(arg => arg.evaluate(env));
    if (this.callee instanceof IdentifierExpression && env.context.native.has(this.callee.name))
      return env.context.native.get(this.callee.name)(args, this);
    const fn = this.callee.evaluate(env);
    if (fn?.kind !== 'function') throw new RuntimeError('El valor no es una función.', this);
    const local = fn.closure.child(`function:${fn.node.name}`);
    fn.node.parameters.forEach((p, i) => local.define(p.name, p.type, args[i] ?? defaults(p.type), 'parámetro'));
    const result = fn.node.body.execute(local, false);
    if (result.kind === 'break' || result.kind === 'continue')
      throw new RuntimeError('Una función no puede transferir control al ciclo del llamador.', this);
    return result.kind === 'return' ? result.value : null;
  }
}
export class VariableDeclaration extends Instruction {
  constructor(type, name, initializer, loc) { super(loc); Object.assign(this, { type, name, initializer }); }
  execute(env) {
    env.define(this.name, this.type, this.initializer ? this.initializer.evaluate(env) : defaults(this.type));
    return NORMAL;
  }
}
export class Assignment extends Instruction {
  constructor(target, value, loc) { 
    super(loc); 
    this.target = target; 
    this.value = value; 

}
  execute(env) { 
    this.target.assign(env, this.value.evaluate(env)); return NORMAL; }
}
export class ExpressionInstruction extends Instruction {
  constructor(expression, loc) { super(loc); this.expression = expression; }
  execute(env) { this.expression.evaluate(env); return NORMAL; }
}
export class Block extends Instruction {
  constructor(instructions, loc) { 
    super(loc); this.instructions = instructions; 
}
  execute(env, createScope = true) {
    const local = createScope ? env.child('block') : env;
    for (const instruction of this.instructions) 
        {
      const result = instruction.execute(local);
      if (result.kind !== 'normal') return result;
    }
    return NORMAL;
  }
}
export class IfInstruction extends Instruction {
  constructor(condition, thenBranch, elseBranch, loc) { super(loc); Object.assign(this, { condition, thenBranch, elseBranch }); }
  execute(env) {
    return this.condition.evaluate(env) ? this.thenBranch.execute(env) : this.elseBranch?.execute(env) ?? NORMAL;
  }
}
export class WhileInstruction extends Instruction {
  constructor(condition, body, loc) { super(loc); this.condition = condition; this.body = body; }
  execute(env) {
    while (this.condition.evaluate(env)) {
      const result = this.body.execute(env);
      if (result.kind === 'break') break;
      if (result.kind === 'return') return result;
    }
    return NORMAL;
  }
}
export class ForInstruction extends Instruction {
  constructor(initializer, condition, update, body, loc) { super(loc); Object.assign(this, { initializer, condition, update, body }); }
  execute(env) {
    const local = env.child('for');
    this.initializer?.execute(local);
    while (!this.condition || this.condition.evaluate(local)) {
      const result = this.body.execute(local);
      if (result.kind === 'break') break;
      if (result.kind === 'return') return result;
      this.update?.execute(local);
    }
    return NORMAL;
  }
}
export class BreakInstruction extends Instruction { execute() { 
    return signal('break'); 
} }
export class ContinueInstruction extends Instruction { execute() { 
    return signal('continue'); 
} }
export class ReturnInstruction extends Instruction {
  constructor(value, loc) { 
    super(loc); this.value = value; 
}
  execute(env) { 
    return signal('return', this.value?.evaluate(env) ?? null); 
 }
}
export class FunctionDeclaration extends Instruction {
  constructor(name, parameters, returnType, body, loc) { super(loc); Object.assign(this, { name, parameters, returnType, body }); }
  execute(env) { 
    env.define(this.name, this.returnType, { kind: 'function', node: this, closure: env }, 'función'); return NORMAL; }
}


export class TaskDeclaration extends Instruction {
  constructor(name, body, loc) { 
    super(loc); this.name = name; this.body = body; }
  execute(env) { 
    env.define(this.name, 'task', { kind: 'task', node: this, closure: env }, 'tarea'); return NORMAL; }
}


export class RunInstruction extends Instruction {
  constructor(name, loc) { super(loc); this.name = name; }
  execute(env) {
    const task = env.get(this.name, this);
    if (task?.kind !== 'task') throw new RuntimeError(`'${this.name}' no es una tarea.`, this);
    const result = task.node.body.execute(task.closure.child(`task:${this.name}`), false);
    if (result.kind !== 'normal') throw new RuntimeError('Transferencia de control fuera de una tarea.', this);
    return NORMAL;
  }
}


export class ResourceProperty extends Node {
  constructor(name, value, loc) { 
    super(loc); this.name = name; this.value = value; }
}

export class ResourceDeclaration extends Instruction {
  constructor(type, name, properties, loc) { super(loc); Object.assign(this, { type, name, properties }); }
  register(env) {
    const resource = env.context.infrastructure.create(this.type, this.name);
    env.define(this.name, this.type, resource, 'recurso');
  }


  execute(env) {
    const values = Object.fromEntries(this.properties.map(p => [p.name, p.value.evaluate(env)]));
    env.context.infrastructure.configure(env.get(this.name, this), values, this);
    return NORMAL;
  }
}


export class Program extends Instruction {
  constructor(declarations, main, loc) { 
    super(loc); this.declarations = declarations; this.main = main; }
  execute(env) {
    for (const node of this.declarations) {
      if (node instanceof ResourceDeclaration) node.register(env);
      else if (node instanceof FunctionDeclaration || node instanceof TaskDeclaration) node.execute(env);
    }
    for (const node of this.declarations) {
      if (node instanceof VariableDeclaration || node instanceof ResourceDeclaration) node.execute(env);
    }
    const result = this.main.execute(env.child('main'), false);
    if (result.kind !== 'normal') throw new RuntimeError('Transferencia de control fuera del contexto ejecutable.', this.main);
    return NORMAL;
  }
}