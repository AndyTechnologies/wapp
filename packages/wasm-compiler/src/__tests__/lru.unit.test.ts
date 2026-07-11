import { LRUCache } from '../lru.js';

describe('LRUCache', () => {
  it('set y get basicos', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('retorna undefined para claves inexistentes', () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('evita el elemento mas antiguo cuando alcanza el maximo', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('mueve al frente en get (LRU)', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('delete elimina claves', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.has('a')).toBe(false);
  });

  it('has retorna true/false correctamente', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('x', 42);
    expect(cache.has('x')).toBe(true);
    expect(cache.has('y')).toBe(false);
  });
});
