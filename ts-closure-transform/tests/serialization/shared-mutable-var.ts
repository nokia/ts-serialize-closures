
import { equal } from 'node:assert';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

function createCounter() {
  let count = 0;
  return {
    get: (() => count),
    increment: (() => { count++ })
  };
}

export function sharedMutableVariableTest() {
  let counter = createCounter();
  let roundtrippedCounter = roundtrip(counter);

  equal(counter.get(), counter.get());
  counter.increment();
  roundtrippedCounter.increment();
  equal(counter.get(), roundtrippedCounter.get());
}

let sharedGlobal = 0;
function incrementSharedGlobal() {
  return sharedGlobal++;
}

export function sharedMutableVariableTest2() {
  let inc = roundtrip(incrementSharedGlobal);

  equal(incrementSharedGlobal(), inc());
  equal(incrementSharedGlobal(), inc());
}
