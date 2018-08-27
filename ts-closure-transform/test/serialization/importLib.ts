
import { expect } from 'chai';
import { Person } from '../lib';
import { deserialize, serialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

export function callImportTest() {
  let originalCreate = () => Person.create("Clark Kent", "clark.kent@gmail.com");
  let create = roundtrip(originalCreate);
  expect(create().toString()).to.equal(originalCreate().toString());
}
