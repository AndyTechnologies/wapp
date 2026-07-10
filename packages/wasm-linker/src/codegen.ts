import { ResolvedLink } from './linker.js';
import path from 'path';

export interface HostFuncDef {
  module: string;
  name: string;
  params: string[];
  paramsType: string;
  body: string;
}

const DEFAULT_HOST_FUNCS: HostFuncDef[] = [
  {
    module: 'env',
    name: 'abort',
    params: ['int32_t message', 'int32_t fileName', 'int32_t line', 'int32_t col'],
    paramsType: 'std::tuple<int32_t,int32_t,int32_t,int32_t>',
    body: '',
  },
];

export function generateCCode(link: ResolvedLink, entryPoint: string, wasi: boolean, hostFuncs?: HostFuncDef[]): string {
  const modules = link.order;
  const moduleBuffers = modules.map(m => ({
    varName: `wasm_bytes_${m.index}`,
    lenVar: `wasm_len_${m.index}`,
    bytes: m.module.buffer,
    moduleVar: `mod${m.index}`,
    instanceVar: `instance${m.index}`,
  }));

  const allHostFuncs = [...(hostFuncs ?? []), ...DEFAULT_HOST_FUNCS];

  // Collect which host funcs are actually needed by the modules
  const neededHostFuncs = new Map<string, HostFuncDef>();
  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.module === 'wasi_snapshot_preview1' || imp.module === 'wasi_unstable') continue;
      const key = `${imp.module}.${imp.name}`;
      const hf = allHostFuncs.find(h => h.module === imp.module && h.name === imp.name);
      if (hf) {
        neededHostFuncs.set(key, hf);
      }
    }
  }

  let cpp = `#include <wasmtime.hh>\n#include <iostream>\n#include <cstdlib>\n#include <cstring>\n\nusing namespace wasmtime;\n\n`;

  for (const mb of moduleBuffers) {
    const byteStr = Array.from(mb.bytes).join(',');
    cpp += `const unsigned char ${mb.varName}[] = { ${byteStr} };\n`;
    cpp += `const size_t ${mb.lenVar} = ${mb.bytes.length};\n\n`;
  }

  cpp += `static void define_exports(Linker &linker, Store::Context ctx, Instance instance, const char* instance_label) {\n`;
  for (const mod of modules) {
    const exports = mod.module.exports;
    if (exports.length === 0) continue;
    cpp += `  if (std::strcmp(instance_label, "instance${mod.index}") == 0) {\n`;
    for (const exp of exports) {
      cpp += `    {\n`;
      cpp += `      auto exp = instance.get(ctx, "${exp.name}");\n`;
      cpp += `      if (!exp) { std::cerr << "Error obteniendo export ${exp.name}" << std::endl; std::exit(1); }\n`;
      cpp += `      auto result = linker.define(ctx, "env", "${exp.name}", *exp);\n`;
      cpp += `      if (!result) { std::cerr << "Error definiendo ${exp.name}" << std::endl; std::exit(1); }\n`;
      cpp += `    }\n`;
    }
    cpp += `    return;\n  }\n`;
  }
  cpp += `  std::cerr << "Unknown instance label " << instance_label << std::endl; std::exit(1);\n`;
  cpp += `}\n\n`;

  cpp += `int main(int argc, char *argv[]) {\n`;
  cpp += `  Engine engine;\n`;
  cpp += `  Store store(engine);\n`;
  cpp += `  auto ctx = store.context();\n`;
  cpp += `  Linker linker(engine);\n`;

  if (wasi) {
    cpp += `\n  WasiConfig wasi_config;\n`;
    cpp += `  wasi_config.inherit_argv();\n`;
    cpp += `  wasi_config.inherit_stdin();\n`;
    cpp += `  wasi_config.inherit_stdout();\n`;
    cpp += `  wasi_config.inherit_stderr();\n`;
    cpp += `  ctx.set_wasi(std::move(wasi_config)).unwrap();\n`;
    cpp += `  linker.define_wasi().unwrap();\n`;
  }

  // Define host functions
  for (const [, hf] of neededHostFuncs) {
    cpp += `\n  linker.func_wrap("${hf.module}", "${hf.name}", [](Caller caller`;
    for (const p of hf.params) {
      cpp += `, ${p}`;
    }
    cpp += `) -> std::monostate {\n`;
    if (hf.body) {
      cpp += `    ${hf.body}\n`;
    }
    cpp += `    return std::monostate{};\n  }).unwrap();\n`;
  }

  for (const mb of moduleBuffers) {
    cpp += `\n  auto ${mb.moduleVar} = Module::compile(engine, Span<uint8_t>(const_cast<uint8_t*>(${mb.varName}), ${mb.lenVar}));\n`;
    cpp += `  if (!${mb.moduleVar}) { std::cerr << "Error compilando modulo: " << ${mb.moduleVar}.err().message() << std::endl; return 1; }\n`;
  }

  for (const mod of modules) {
    const iv = `instance${mod.index}`;
    const mv = `mod${mod.index}`;
    cpp += `\n  auto ${iv} = linker.instantiate(ctx, ${mv}.unwrap());\n`;
    cpp += `  if (!${iv}) {\n`;
    cpp += `    std::cerr << "Error instanciando modulo ${mod.index}" << std::endl;\n`;
    cpp += `    return 1;\n  }\n`;
    cpp += `  define_exports(linker, ctx, ${iv}.unwrap(), "${iv}");\n`;
  }

  let entryIdx = '';
  for (const mod of modules) {
    const found = mod.module.exports.some(e => e.name === entryPoint && e.kind === 'function');
    if (found) { entryIdx = `instance${mod.index}`; break; }
  }
  if (!entryIdx) {
    throw new Error(`No se encontro la funcion de entrada '${entryPoint}' en ningun modulo.`);
  }

  cpp += `\n  auto entry_exp = ${entryIdx}.unwrap().get(ctx, "${entryPoint}");\n`;
  cpp += `  if (!entry_exp) { std::cerr << "Entry point ${entryPoint} no encontrado" << std::endl; return 1; }\n`;
  cpp += `  if (!std::get_if<Func>(&*entry_exp)) { std::cerr << "${entryPoint} no es una funcion" << std::endl; return 1; }\n`;
  cpp += `  auto entry_func = std::get<Func>(*entry_exp);\n`;
  cpp += `  auto result = entry_func.call(ctx, {});\n`;
  cpp += `  if (!result) {\n`;
  cpp += `    std::cerr << "Error llamando a ${entryPoint}" << std::endl;\n`;
  cpp += `    return 1;\n  }\n\n`;

  cpp += `  return 0;\n`;
  cpp += `}\n`;

  return cpp;
}