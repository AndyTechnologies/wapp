import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, '..', 'examples');
const outDir = path.resolve(os.tmpdir(), 'wasm-test-out');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const cliScript = path.resolve(__dirname, '..', 'dist', 'cli.js');

console.log(`Compilando ejemplos desde ${examplesDir}...`);

const result = spawnSync('node', [cliScript, 'build', '-o', outDir, examplesDir], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

if (result.status !== 0) {
  console.error('Error: la compilacion de ejemplos fallo.');
  process.exit(1);
}

const names = ['math', 'strings', 'buffer'];
let allOk = true;

for (const name of names) {
  const wasmPath = path.join(outDir, `${name}.wasm`);
  if (!fs.existsSync(wasmPath)) {
    console.error(`FAIL: No se encontro ${wasmPath}`);
    allOk = false;
    continue;
  }
  const buf = fs.readFileSync(wasmPath);
  try {
    const mod = new WebAssembly.Module(buf);
    const exports = WebAssembly.Module.exports(mod);
    console.log(`OK: ${name}.wasm (${exports.length} exports)`);
  } catch (err) {
    console.error(`FAIL: ${name}.wasm no es un modulo WebAssembly valido: ${err.message}`);
    allOk = false;
  }
}

if (allOk) {
  console.log('\nTodos los ejemplos compilados correctamente.');
} else {
  console.error('\nAlgunos ejemplos fallaron.');
  process.exit(1);
}