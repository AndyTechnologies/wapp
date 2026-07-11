import { compareHash, hashString, parseExports, resolveImportPath } from '../utils.js';
import type { ResolvedAlias } from 'wapp-types';

describe('compareHash', () => {
  it('retorna true para hashes iguales', () => {
    expect(compareHash('abc123', 'abc123')).toBe(true);
  });

  it('retorna false para hashes diferentes', () => {
    expect(compareHash('abc123', 'def456')).toBe(false);
  });
});

describe('hashString', () => {
  it('genera un hash sha256 de 64 caracteres hex', () => {
    const hash = hashString('hello world');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it('genera el mismo hash para el mismo input', () => {
    expect(hashString('test')).toBe(hashString('test'));
  });

  it('genera hashes diferentes para inputs diferentes', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('parseExports', () => {
  it('parsea funciones exportadas', () => {
    const result = parseExports('export declare function add(a: i32): i32;\n');
    expect(result).toContainEqual({ name: 'add', kind: 'function' });
  });

  it('parsea clases exportadas', () => {
    const result = parseExports('export declare class Foo { }\n');
    expect(result).toContainEqual({ name: 'Foo', kind: 'class' });
  });

  it('parsea constantes exportadas', () => {
    const result = parseExports('export declare const VERSION: i32;\n');
    expect(result).toContainEqual({ name: 'VERSION', kind: 'const' });
  });

  it('retorna array vacio si no hay exports', () => {
    expect(parseExports('')).toEqual([]);
  });
});

describe('resolveImportPath', () => {
  const aliases: ResolvedAlias[] = [
    { find: '@lib/', replacement: '/project/lib' },
  ];

  it('resuelve alias de string prefix', () => {
    const result = resolveImportPath('@lib/math', '/project/src/index.ts', aliases);
    expect(result).toBe('/project/lib/math');
  });

  it('resuelve rutas relativas', () => {
    const result = resolveImportPath('./foo', '/project/src/index.ts', []);
    expect(result).toBe('/project/src/foo');
  });

  it('retorna la ruta tal cual si no es relativa ni alias', () => {
    const result = resolveImportPath('some-package', '/project/src/index.ts', []);
    expect(result).toBe('some-package');
  });
});
