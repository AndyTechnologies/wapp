import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const cliScript = path.join(projectRoot, 'dist', 'cli.js');
const examplesDir = path.join(projectRoot, 'examples');

describe('wasm-compiler', () => {
  const outDir = path.resolve(os.tmpdir(), 'wasm-compiler-test-out');
  const names = ['math', 'strings', 'buffer'];

  beforeAll(() => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('compila ejemplos AssemblyScript a WebAssembly valido', () => {
    const result = spawnSync('node', [cliScript, 'build', '-o', outDir, examplesDir], {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);

    for (const name of names) {
      const wasmPath = path.join(outDir, `${name}.wasm`);
      expect(fs.existsSync(wasmPath)).toBe(true);

      const buf = fs.readFileSync(wasmPath);
      const mod = new WebAssembly.Module(buf);
      const exports = WebAssembly.Module.exports(mod);
      expect(exports.length).toBeGreaterThanOrEqual(0);
    }
  });
});
