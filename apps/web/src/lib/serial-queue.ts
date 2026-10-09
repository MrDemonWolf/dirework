/**
 * Run async tasks strictly one at a time, in submission order. Each `run`
 * settles with its own task's result, and a rejection never stalls the tasks
 * queued after it.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task);
    // Keep the chain alive even if a link rejects, or every later task would
    // inherit the rejection and silently stop being processed.
    tail = next.catch(() => undefined);
    return next;
  };
}
