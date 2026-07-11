import { resolveDependencies } from '../linker.js';
import type { WasmModuleInfo } from 'wapp-types';

function makeMod(fileName: string, exports: string[], imports: { module: string; name: string }[] = []): WasmModuleInfo {
  return {
    fileName,
    buffer: Buffer.alloc(0),
    imports: imports.map(i => ({ ...i, kind: 'function' as const })),
    exports: exports.map(e => ({ name: e, kind: 'function' as const })),
  };
}

describe('resolveDependencies', () => {
  it('ordena modulos independientes', () => {
    const a = makeMod('a.wasm', ['foo']);
    const b = makeMod('b.wasm', ['bar']);
    const result = resolveDependencies([b, a], 'name-only');
    expect(result.order.map(m => m.module.fileName)).toEqual(['b.wasm', 'a.wasm']);
  });

  it('respeta orden topologico con dependencias', () => {
    const a = makeMod('a.wasm', ['foo'], [{ module: 'env', name: 'bar' }]);
    const b = makeMod('b.wasm', ['bar']);
    const result = resolveDependencies([a, b], 'name-only');
    expect(result.order[0].module.fileName).toBe('b.wasm');
    expect(result.order[1].module.fileName).toBe('a.wasm');
  });

  it('detecta dependencias circulares', () => {
    const a = makeMod('a.wasm', ['x'], [{ module: 'env', name: 'y' }]);
    const b = makeMod('b.wasm', ['y'], [{ module: 'env', name: 'x' }]);
    expect(() => resolveDependencies([a, b], 'name-only')).toThrow(/circular/i);
  });

  it('ignora imports de wasi y host conocidos', () => {
    const a = makeMod('a.wasm', ['foo'], [
      { module: 'wasi_snapshot_preview1', name: 'fd_write' },
      { module: 'env', name: 'abort' },
    ]);
    const result = resolveDependencies([a], 'name-only');
    expect(result.order).toHaveLength(1);
  });

  it('lanza error si una importacion no se resuelve', () => {
    const a = makeMod('a.wasm', [], [{ module: 'env', name: 'missing' }]);
    expect(() => resolveDependencies([a], 'name-only')).toThrow(/no resuelta/i);
  });

  it('mapea exports correctamente', () => {
    const a = makeMod('a.wasm', ['foo']);
    const result = resolveDependencies([a], 'name-only');
    expect(result.exportMap.get('foo')).toEqual({ instance: 'instance0', name: 'foo' });
  });
});
