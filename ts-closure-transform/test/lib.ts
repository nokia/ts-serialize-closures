export class Person {

  constructor(
    readonly name: string,
    readonly email: string) {

  }

  toString(): string {
    return `${this.name} <${this.email}>`;
  }
}
