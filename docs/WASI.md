# WASI Support in wapp

## Overview

WASI (WebAssembly System Interface) allows WebAssembly modules to access operating system facilities such as file I/O, clock, random numbers, and environment variables. wapp provides optional WASI support when linking modules into native executables.

## Current Status

WASI support in wapp is **experimental**. The system interface is forwarded through the Wasmtime runtime when enabled.

### Supported features

- File system access (open, read, write, close)
- Clock time and monotonic clocks
- Random number generation
- Environment variables
- Standard I/O (stdin/stdout/stderr)

### Limitations

- WASI preview 1 is currently supported (preview 2 is not yet implemented)
- Network sockets are not currently exposed
- Asynchronous I/O is limited
- WASI threads are not supported

## Enabling WASI

### CLI

```bash
wapp link --wasi
```

### Configuration file

```json
{
  "wasi": true
}
```

### Programmatic usage

```typescript
import { createNativeApp } from 'wasm-linker';

const binary = await createNativeApp({
  modules: ['./dist/module.wasm'],
  wasi: true,
});
```

## Writing WASI-compatible modules

In your AssemblyScript code, you can use WASI imports directly:

```typescript
// Environment variables
export function getEnv(key: string): string {
  // Access environment via WASI
  return Environment.getVariable(key);
}

// File I/O
export function readFile(path: string): string {
  const fd = FileSystem.open(path, 'r');
  const content = FileSystem.read(fd);
  FileSystem.close(fd);
  return content;
}
```

## Troubleshooting

**Module fails with "WASI unimplemented"**: The WASI function you're calling may not be implemented yet. Check the [wasi.md](https://github.com/WebAssembly/WASI/blob/main/phases/README.md) specification for supported calls.

**Permission denied**: WASI sandboxes file system access. Ensure the module has access to the required paths.
