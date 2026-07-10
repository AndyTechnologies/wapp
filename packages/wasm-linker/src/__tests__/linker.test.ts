import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const cliScript = path.join(projectRoot, 'dist', 'cli.js');
const examplesDir = path.join(projectRoot, 'examples');

describe('wasm-linker', () => {
  const outDir = path.resolve(os.tmpdir(), 'wasm-linker-test-out');

  beforeEach(() => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('compila hello.wasm a ejecutable nativo y se ejecuta correctamente', () => {
    const wasmFile = path.join(examplesDir, 'hello.wasm');
    expect(fs.existsSync(wasmFile)).toBe(true);

    const outputExe = path.join(outDir, 'native-hello');

    const result = spawnSync('node', [
      cliScript, 'build', '-o', outputExe, '-e', 'main', wasmFile,
    ], {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputExe)).toBe(true);

    const runResult = spawnSync(outputExe, [], { encoding: 'utf-8' });
    expect(runResult.status).toBe(0);
  });
});
