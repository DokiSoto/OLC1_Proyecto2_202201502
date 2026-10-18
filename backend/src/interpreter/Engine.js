import { Lexer } from '../lexer/Lexer.js';
import { Parser } from '../parser/Parser.js';
import { Environment, RuntimeError, printable } from '../environment/Environment.js';
import { Infrastructure } from '../infrastructure/Infrastructure.js';

export function executeSource(source, execute = true) {
  const started = performance.now();
  const scanned = new Lexer(source).scan();
  const parsed = new Parser(scanned.tokens).parse();
  const context = { errors: [...scanned.errors, ...parsed.errors], console: [], log: [], symbols: [], scopeId: 0 };
  context.infrastructure = new Infrastructure(context);
  context.native = context.infrastructure.actions();
  const global = new Environment(null, 'global', context);
  if (execute && context.errors.length === 0 && parsed.ast) {
    try { parsed.ast.execute(global); }
    catch (error) {
      context.errors.push(error instanceof RuntimeError ? error.detail : {
        type: 'Ejecución', code: 'RUN-999', description: error.message,
        line: parsed.ast.main.line, column: parsed.ast.main.column,
      });
    }
  }
  return {
    success: context.errors.length === 0,
    executed: execute && scanned.errors.length === 0 && parsed.errors.length === 0 && Boolean(parsed.ast),
    console: context.console, errors: context.errors,
    tokens: scanned.tokens.filter(t => t.type !== 'EOF'),
    symbols: context.symbols.map(row => ({ ...row, value: printable(row.value) })),
    ast: parsed.ast?.toTree() ?? null,
    infrastructure: context.infrastructure.report(), log: context.log,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  };
}