
import { expect } from 'chai';
import { Person } from '../lib';
import { deserialize, serialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

export function callImportTest() {
  expect(roundtrip(new Person("Clark Kent", "clark.kent@gmail.com")).toString())
    .to.equal("Clark Kent <clark.kent@gmail.com>");
}
