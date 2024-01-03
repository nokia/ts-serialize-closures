
import { equal } from 'node:assert';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

class Vector2 {
  x: number;
  y: number;

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}

export function classObject() {
  equal(roundtrip(new Vector2(3, 4)).length, 5);
}

export function constructorCall() {
  equal(roundtrip(() => new Vector2(3, 4))().length, 5);
}
