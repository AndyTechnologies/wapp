import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const cliScript = path.join(projectRoot, 'dist', 'cli.js');
const tmpDir = path.resolve(os.tmpdir(), 'wapp-cli-test');

function run(args, cwd) {
  return spawnSync(process.execPath, [cliScript, ...args], {
    cwd: cwd ?? projectRoot,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

function generateSimpleWasm(outPath) {
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

try {
  // test 1: init
  {
    const testDir = path.join(tmpDir, 'test-init');
    fs.mkdirSync(testDir, { recursive: true });

    const result = run(['init', '--entry', 'main'], testDir);
    if (result.status !== 0) {
      throw new Error('init fallo: ' + result.stderr);
    }

    const configPath = path.join(testDir, 'wapp.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('init no creo wapp.json');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.entry !== 'main') {
      throw new Error("entry esperado 'main', obtenido '" + config.entry + "'");
    }

    const dupResult = run(['init'], testDir);
    if (dupResult.status === 0) {
      throw new Error('init duplicado deberia fallar');
    }

    console.log('OK: init');
  }

  // test 2: build con archivo .wasm
  {
    const testDir = path.join(tmpDir, 'test-build-wasm');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'wapp.json'), JSON.stringify({ sourceDir: 'mods', outDir: 'dist', entry: 'main' }, null, 2) + '\n');

    const modsDir = path.join(testDir, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    if (!generateSimpleWasm(path.join(modsDir, 'hello.wasm'))) {
      throw new Error('no se pudo generar hello.wasm');
    }

    const result = run(['build'], testDir);
    if (result.status !== 0) {
      throw new Error('build de wasm fallo: ' + result.stderr);
    }

    const outputExe = path.join(testDir, 'dist', 'output');
    if (!fs.existsSync(outputExe)) {
      throw new Error('no se encontro el ejecutable de salida');
    }

    const runResult = spawnSync(outputExe, [], { encoding: 'utf-8' });
    if (runResult.status !== 0) {
      throw new Error('ejecutable termino con codigo ' + runResult.status);
    }

    console.log('OK: build (con archivo .wasm)');
  }

  // test 3: build con --output y --entry
  {
    const testDir = path.join(tmpDir, 'test-build-flags');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'wapp.json'), JSON.stringify({ sourceDir: 'mods', outDir: 'dist', entry: 'main' }, null, 2) + '\n');
    fs.mkdirSync(path.join(testDir, 'mods'), { recursive: true });
    if (!generateSimpleWasm(path.join(testDir, 'mods', 'mod.wasm'))) {
      throw new Error('no se pudo generar mod.wasm');
    }

    const result = run(['build', 'mods', '-o', 'my-app', '-e', 'main'], testDir);
    if (result.status !== 0) {
      throw new Error('build con flags fallo: ' + result.stderr);
    }

    const outPath = path.join(testDir, 'my-app');
    if (!fs.existsSync(outPath)) {
      throw new Error('no se encontro my-app');
    }

    const runResult = spawnSync(outPath, [], { encoding: 'utf-8' });
    if (runResult.status !== 0) {
      throw new Error('ejecutable my-app termino con codigo ' + runResult.status);
    }

    console.log('OK: build (con --output y --entry)');
  }

  console.log('\nTodos los tests pasaron.');
} finally {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}