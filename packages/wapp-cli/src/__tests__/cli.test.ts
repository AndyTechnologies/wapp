import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const cliScript = path.join(projectRoot, 'dist', 'cli.js');
const tmpRoot = path.resolve(os.tmpdir(), 'wapp-cli-test');

afterEach(() => {
  try {
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup errors
  }
});

function run(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cliScript, ...args], {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

function generateSimpleWasm(outPath: string): boolean {
  const result = spawnSync(process.execPath, ['-e', `
    const fs = require('fs');
    function uleb128(v) { const b = []; do { let byte = v & 0x7f; v = v >>> 7; if (v !== 0) byte |= 0x80; b.push(byte); } while (v !== 0); return b; }
    function sec(id, d) { const s = uleb128(d.length); return [id, ...s, ...d]; }
    const t = [1, 0x60, 0, 1, 0x7f]; const f = [1, 0];
    const e = [2, 4, 0x6d, 0x61, 0x69, 0x6e, 0, 0, 6, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 2, 0];
    const m = [1, 0, 1]; const c = [1, 4, 0, 0x41, 0x2a, 0x0b];
    const w = Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, ...sec(1, t), ...sec(3, f), ...sec(5, m), ...sec(7, e), ...sec(10, c)]);
    fs.writeFileSync(process.argv[1], w);
  `, outPath]);
  return result.status === 0;
}

describe('wapp-cli', () => {
  it('init crea wapp.json y falla en duplicado', () => {
    const testDir = path.join(tmpRoot, 'test-init');
    fs.mkdirSync(testDir, { recursive: true });

    const result = run(['init', '--entry', 'main'], testDir);
    expect(result.status).toBe(0);

    const configPath = path.join(testDir, 'wapp.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.entry).toBe('main');

    const dupResult = run(['init'], testDir);
    expect(dupResult.status).not.toBe(0);
  });

  it('build compila .wasm a ejecutable nativo y se ejecuta', () => {
    const testDir = path.join(tmpRoot, 'test-build-wasm');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'wapp.json'), JSON.stringify({ sourceDir: 'mods', outDir: 'dist', entry: 'main' }, null, 2) + '\n');

    const modsDir = path.join(testDir, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    expect(generateSimpleWasm(path.join(modsDir, 'hello.wasm'))).toBe(true);

    const result = run(['build'], testDir);
    expect(result.status).toBe(0);

    const outputExe = path.join(testDir, 'dist', 'output');
    expect(fs.existsSync(outputExe)).toBe(true);

    const runResult = spawnSync(outputExe, [], { encoding: 'utf-8' });
    expect(runResult.status).toBe(0);
  });

  it('build con --output y --entry produce ejecutable correcto', () => {
    const testDir = path.join(tmpRoot, 'test-build-flags');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'wapp.json'), JSON.stringify({ sourceDir: 'mods', outDir: 'dist', entry: 'main' }, null, 2) + '\n');
    fs.mkdirSync(path.join(testDir, 'mods'), { recursive: true });
    expect(generateSimpleWasm(path.join(testDir, 'mods', 'mod.wasm'))).toBe(true);

    const result = run(['build', 'mods', '-o', 'my-app', '-e', 'main'], testDir);
    expect(result.status).toBe(0);

    const outPath = path.join(testDir, 'my-app');
    expect(fs.existsSync(outPath)).toBe(true);

    const runResult = spawnSync(outPath, [], { encoding: 'utf-8' });
    expect(runResult.status).toBe(0);
  });
});
