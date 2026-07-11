import { findEntryModule, generateCCode } from '../codegen.js';
import type { WasmModuleInfo, ResolvedLink, WasmImport } from 'wapp-types';

function makeResolvedLink(exports: string[][], imports?: WasmImport[][]): ResolvedLink {
  const modules: WasmModuleInfo[] = exports.map((exp, i) => ({
    fileName: `mod${i}.wasm`,
    buffer: Buffer.alloc(4),
    imports: imports?.[i] ?? [],
    exports: exp.map(e => ({ name: e, kind: 'function' as const })),
  }));
  return {
    order: modules.map((m, i) => ({ module: m, index: i, instanceName: `instance${i}` })),
    exportMap: new Map(),
  };
}

describe('findEntryModule', () => {
  it('encuentra el modulo que contiene el entry point', () => {
    const link = makeResolvedLink([['foo'], ['main'], ['bar']]);
    const instance = findEntryModule(link, 'main');
    expect(instance).toBe('instance1');
  });

  it('lanza error si el entry point no existe', () => {
    const link = makeResolvedLink([['foo'], ['bar']]);
    expect(() => findEntryModule(link, 'missing')).toThrow(/no se encontro/i);
  });
});

describe('generateCCode', () => {
  it('genera codigo C++ valido', () => {
    const link = makeResolvedLink([['main']]);
    const code = generateCCode(link, 'main', false);
    expect(code).toContain('#include <wasmtime.hh>');
    expect(code).toContain('int main(');
    expect(code).toContain('entry_func.call');
    expect(code).toContain('return 0;');
  });

  it('incluye configuracion WASI cuando se solicita', () => {
    const link = makeResolvedLink([['_start']]);
    const code = generateCCode(link, '_start', true);
    expect(code).toContain('WasiConfig');
    expect(code).toContain('define_wasi');
  });

  it('incluye host functions por defecto (env.abort)', () => {
    const link = makeResolvedLink([['main']], [[{ module: 'env', name: 'abort', kind: 'function' }]]);
    const code = generateCCode(link, 'main', false);
    expect(code).toContain('func_wrap');
    expect(code).toContain('"env", "abort"');
  });
});
