import fs from 'fs';

export interface WasmExport {
  name: string;
  kind: 'function' | 'memory' | 'table' | 'global';
}

export interface WasmImport {
  module: string;
  name: string;
  kind: 'function' | 'memory' | 'table' | 'global';
}

export interface WasmModuleInfo {
  fileName: string;
  buffer: Buffer;
  imports: WasmImport[];
  exports: WasmExport[];
}

export async function readWasmModules(filePaths: string[]): Promise<WasmModuleInfo[]> {
  const modules: WasmModuleInfo[] = [];
  for (const filePath of filePaths) {
    const buffer = fs.readFileSync(filePath);
    const wasmModule = new WebAssembly.Module(buffer);
    const imports = WebAssembly.Module.imports(wasmModule).map(imp => ({
      module: imp.module,
      name: imp.name,
      kind: imp.kind as WasmImport['kind'],
    }));
    const exports = WebAssembly.Module.exports(wasmModule).map(exp => ({
      name: exp.name,
      kind: exp.kind as WasmExport['kind'],
    }));

    modules.push({ fileName: filePath, buffer, imports, exports });
  }
  return modules;
}
