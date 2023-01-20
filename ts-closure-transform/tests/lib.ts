export class Person {

  constructor(
    readonly name: string,
    readonly email: string) {

  }

  toString(): string {
    return `${this.name} <${this.email}>`;
  }

  static create(name: string, email: string) {
    return new Person(name, email);
  }
}

export function formatPerson(name: string, email: string) {
  return new Person(name, email).toString();
}

export default Person