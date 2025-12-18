export function addTimeout<T>(
  promise: Promise<T>,
  { milliseconds }: { milliseconds: number },
): Promise<T> {
  const newTimeoutError = new Error('Timed out');

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(newTimeoutError);
    }, milliseconds);

    promise.then((res) => {
      clearTimeout(timeoutId);
      resolve(res);
    }, reject);
  });
}
