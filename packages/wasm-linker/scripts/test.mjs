import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, '..', 'examples');
const outDir = path.resolve(os.tmpdir(), 'wapp-test-out');
const entryPoint = 'main';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const cliScript = path.resolve(__dirname, '..', 'dist', 'cli.js');

const wasmFile = path.join(examplesDir, 'hello.wasm');
if (!fs.existsSync(wasmFile)) {
  console.error(`FAIL: No se encuentra el ejemplo ${wasmFile}`);
  process.exit(1);
}

const outputExe = path.join(outDir, 'native-hello' + (os.platform() === 'win32' ? '.exe' : ''));

console.log(`Compilando ${wasmFile} a ejecutable nativo...`);

const result = spawnSync('node', [cliScript, 'build', '-o', outputExe, '-e', entryPoint, wasmFile], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

if (result.status !== 0) {
  console.error('FAIL: la compilacion del ejecutable nativo fallo.');
  process.exit(result.status);
}

if (!fs.existsSync(outputExe)) {
  console.error(`FAIL: No se encontro el ejecutable generado ${outputExe}`);
  process.exit(1);
}

console.log(`Ejecutando ${outputExe}...`);

const runResult = spawnSync(outputExe, [], {
  stdio: 'inherit',
});

if (runResult.status === 0) {
  console.log(`\nOK: hello.wasm ejecutado correctamente (exit code: 0)`);
} else {
  console.error(`\nFAIL: hello.wasm termino con codigo ${runResult.status}`);
  process.exit(runResult.status);
}