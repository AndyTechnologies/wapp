import { mkdirSync, cpSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const mappings = [
  { src: 'packages/wasm-linker/dist', dest: 'dist/dist-linker' },
  { src: 'packages/wasm-compiler/dist', dest: 'dist/dist-compiler' },
  { src: 'packages/wapp-cli/dist', dest: 'dist/dist-cli' },
  { src: 'packages/wapp-types/dist', dest: 'dist/dist-types' },
];

for (const { src, dest } of mappings) {
  const srcPath = join(root, src);
  const destPath = join(root, dest);

  mkdirSync(destPath, { recursive: true });

  if (existsSync(srcPath)) {
    cpSync(srcPath, destPath, { recursive: true });
  }
}
