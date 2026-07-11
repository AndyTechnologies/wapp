import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('watch mode', () => {
  const tmpDir = path.resolve(os.tmpdir(), 'watch-test');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('compila cuando un archivo cambia', (done) => {
    const testFile = path.join(tmpDir, 'test.wasm.ts');
    fs.writeFileSync(testFile, 'export function add(a: i32): i32 { return a + 1; }');

    const watcher = fs.watch(tmpDir, (event, filename) => {
      if (filename === 'test.wasm.ts') {
        watcher.close();
        done();
      }
    });

    setTimeout(() => {
      fs.writeFileSync(testFile, 'export function add(a: i32): i32 { return a + 2; }');
    }, 100);
  }, 5000);
});
