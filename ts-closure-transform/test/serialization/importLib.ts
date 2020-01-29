
import { expect } from 'chai';
import { Person, formatPerson } from '../lib';
import PersonDefaultImport from "../lib"
import PersonDefaultEqualsImport = require("../lib")
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

export function callDefaultImportTest() {
  let originalCreate = () => PersonDefaultImport.create(name, email);
  let create = roundtrip(originalCreate);
  expect(create().toString()).to.equal(originalCreate().toString());
}

export function callDefaultEqualsImportTest() {
  let originalCreate = () => PersonDefaultEqualsImport.Person.create(name, email);
  let create = roundtrip(originalCreate);
  expect(create().toString()).to.equal(originalCreate().toString());
}
