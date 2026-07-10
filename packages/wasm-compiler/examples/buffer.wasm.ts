// Modulo que demuestra manejo de memoria y buffers
export function createBuffer(size: i32): ArrayBuffer {
  return new ArrayBuffer(size);
}

export function fillBuffer(buf: ArrayBuffer, value: u8): void {
  const arr = Uint8Array.wrap(buf);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = value;
  }
}

export function sumBuffer(buf: ArrayBuffer): i32 {
  const arr = Uint8Array.wrap(buf);
  let sum: i32 = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}