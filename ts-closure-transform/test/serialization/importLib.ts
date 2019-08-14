
import { expect } from 'chai';
import { Person, formatPerson } from '../lib';
import { deserialize, serialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

let name = "Clark Kent";
let email = "clark.kent@gmail.com";

export function callImportTest() {
  let originalCreate = () => Person.create(name, email);
  let create = roundtrip(originalCreate);
  expect(create().toString()).to.equal(originalCreate().toString());
}

export function callImportTest2() {
  expect(roundtrip(formatPerson)(name, email))
    .to.equal(formatPerson(name, email).toString());
}
