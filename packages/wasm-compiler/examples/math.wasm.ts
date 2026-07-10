// Un modulo simple que exporta una funcion de suma
export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function factorial(n: i32): i32 {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}