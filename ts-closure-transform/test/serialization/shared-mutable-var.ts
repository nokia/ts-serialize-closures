
import { expect } from 'chai';
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

  expect(counter.get()).to.equal(counter.get());
  counter.increment();
  roundtrippedCounter.increment();
  expect(counter.get()).to.equal(roundtrippedCounter.get());
}
