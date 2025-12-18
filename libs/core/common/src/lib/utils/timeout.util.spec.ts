import { addTimeout } from './timeout.util';

describe('addTimeout()', () => {
  it('should timeout long unresolved promise', () => {
    const promise = new Promise(() => {
      // do nothing
    });

    expect(addTimeout(promise, { milliseconds: 50 })).rejects.toThrow(
      'Timed out',
    );
  });

  it('should allow promise to resolve', () => {
    const promise = new Promise((resolve) => {
      resolve('resolved');
    });

    expect(addTimeout(promise, { milliseconds: 50 })).resolves.toBe('resolved');
  });
});
