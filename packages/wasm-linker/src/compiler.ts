import { spawn } from 'child_process';

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
      else reject(new Error(`zig cc termino con codigo ${code}`));
    });
    proc.on('error', (err) => reject(err));
  });
}
