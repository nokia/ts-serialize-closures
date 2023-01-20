function createCounter() {
  let count = 0;
  return {
    get: (() => count),
    increment: (() => { count++; })
  };
}
