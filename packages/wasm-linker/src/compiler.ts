import { spawn } from 'child_process';
import { ZigError, logger } from 'wapp-types';

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
  ];

  if (process.platform === 'darwin') {
    args.push('-framework', 'Security', '-framework', 'Foundation');
  } else if (process.platform === 'win32') {
    args.push('-lpthread');
  } else {
    args.push('-lpthread', '-ldl', '-lm');
  }

  logger.detail(`Compilando: ${zigExe} ${args.join(' ')}`);
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(zigExe, args, { stdio: ['inherit', 'inherit', 'pipe'] });
    const stderrChunks: Buffer[] = [];
    proc.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        if (stderr) logger.warn(stderr);
        reject(new ZigError(`zig c++ termino con codigo ${code}`, { exitCode: code, stderr }));
      }
    });
    proc.on('error', (err) => reject(new ZigError(`Error al ejecutar zig: ${err.message}`, { causeMessage: err.message })));
  });
}
