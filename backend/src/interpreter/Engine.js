import { Lexer } from '../lexer/Lexer.js';
import { Parser } from '../parser/Parser.js';
import { Environment, RuntimeError, printable } from '../environment/Environment.js';
import { Infrastructure } from '../infraestructure/Infraestructure.js';

export function emptyResult() {
  return {
    success: false, executed: false, console: [], errors: [], tokens: [], symbols: [], ast: null,
    infrastructure: { servers: [], services: [], databases: [], connections: [] },
    log: [], durationMs: 0,
  };
}
export function executeSource(source, execute = true) {
  const started = performance.now();
  const result = emptyResult();
  const context = { errors: [], console: [], log: [], symbols: [], scopeId: 0 };
  context.infrastructure = new Infrastructure(context);
  context.native = context.infrastructure.actions();
  let ast = null;
  try {
    if (typeof source !== 'string') throw new RuntimeError('source debe ser texto.', {}, 'INPUT-001');
    const scanned = new Lexer(source).scan();
    result.tokens = scanned.tokens.filter(t => t.type !== 'EOF');
    context.errors.push(...scanned.errors);
    const parsed = new Parser(scanned.tokens).parse();
    ast = parsed.ast;
    context.errors.push(...parsed.errors);
    if (execute && context.errors.length === 0 && ast) {
      result.executed = true;
      ast.execute(new Environment(null, 'global', context));
    }
  } catch (error) {
    context.errors.push(error instanceof RuntimeError ? error.detail : {
      type: 'Ejecución', code: 'RUN-999', description: error.message,
      line: ast?.main?.line ?? 1, column: ast?.main?.column ?? 1,
    });
  }
  result.console = context.console;
  result.log = context.log;
  result.errors = context.errors;
  try {
    result.ast = ast?.toTree() ?? null;
    result.symbols = context.symbols.map(row => ({ ...row, value: printable(row.value) }));
    result.infrastructure = context.infrastructure.report();
  } catch (error) {
    result.errors.push({ type: 'Ejecución', code: 'REPORT-001', description: error.message, line: 1, column: 1 });
  }
  result.success = result.errors.length === 0;
  result.durationMs = Math.round((performance.now() - started) * 100) / 100;
  return result;
}