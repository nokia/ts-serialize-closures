import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

export function* myGenerator() {
  yield 42;
  yield 84;
}

export function simpleGenerator() {
  expect(myGenerator().next()).to.equal(42);
}

export function roundtripGeneratorConstructor() {
  expect(roundtrip(myGenerator)().next()).to.equal(42);
}

export function roundtripGeneratorInProgress() {
  const gen = myGenerator();
  expect(gen.next()).to.equal(42);
  expect(roundtrip(gen).next()).to.equal(84);
}