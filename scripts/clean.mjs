import { rmSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const dirs = ['dist', 'node_modules'];

function removeRecursive(basePath) {
  for (const dir of dirs) {
    const target = join(basePath, dir);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  }
}

removeRecursive(root);

const packagesDir = join(root, 'packages');
if (existsSync(packagesDir)) {
  for (const pkg of readdirSync(packagesDir)) {
    removeRecursive(join(packagesDir, pkg));
  }
}
