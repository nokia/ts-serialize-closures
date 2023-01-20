
function repeat<T>(value: T, count: number): T[] {
  let results: T[] = [];
  for (let i = 0; i < count; i++) {
    results.push(value);
  }
  return <T[]>results;
}
