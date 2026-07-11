import { spawn } from 'child_process';
import { ZigError } from 'wapp-types';

export interface CompileOptions {
  source: string;
  includeDir: string;
  libPath: string;
  output: string;
  target?: string;
  wasi: boolean;
}

export async function compileWithZig(zigExe: string, opts: CompileOptions): Promise<void> {
  const args = [
    'c++',
    '-target', opts.target || 'native',
    '-I', opts.includeDir,
    '-Wno-nullability-completeness',
    opts.source,
    opts.libPath,
    '-o', opts.output,
    '-lpthread', '-ldl', '-lm',
  ];

  if (process.platform === 'darwin') {
    args.push('-framework', 'Security', '-framework', 'Foundation');
  }

  console.log(`Compilando: ${zigExe} ${args.join(' ')}`);
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(zigExe, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new ZigError(`zig c++ termino con codigo ${code}`, { exitCode: code }));
    });
    proc.on('error', (err) => reject(new ZigError(`Error al ejecutar zig: ${err.message}`, { causeMessage: err.message })));
  });
}
