import { equal } from "node:assert";
import { Person, formatPerson } from "../lib";
import PersonDefaultImport from "../lib";
import PersonDefaultEqualsImport = require("../lib");
import * as person from "../lib";
import { deserialize, serialize } from "../../../serialize-closures/src";

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

let name = "Clark Kent";
let email = "clark.kent@gmail.com";

export function callImportTest() {
  let originalCreate = () => Person.create(name, email);
  let create = roundtrip(originalCreate);
  equal(create().toString(), originalCreate().toString());
}

export function callImportTest2() {
  equal(
    roundtrip(formatPerson)(name, email),
    formatPerson(name, email).toString()
  );
}

export function callDefaultImportTest() {
  let originalCreate = () => PersonDefaultImport.create(name, email);
  let create = roundtrip(originalCreate);
  equal(create().toString(), originalCreate().toString());
}

export function callDefaultEqualsImportTest() {
  let originalCreate = () =>
    PersonDefaultEqualsImport.Person.create(name, email);
  let create = roundtrip(originalCreate);
  equal(create().toString(), originalCreate().toString());
}

export function callAliasImportTest() {
  let originalCreate = () => person.Person.create(name, email);
  let create = roundtrip(originalCreate);
  equal(create().toString(), originalCreate().toString());
}
