import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

export function roundTripClosure() {
  let mul = (x, y) => x * y;
  let factorial = i => {
    if (i <= 0) {
      return 1;
    } else {
      return mul(i, factorial(i - 1));
    }
  };

  expect(roundtrip(factorial)(5)).to.equal(120);
}

export function roundTripNestedClosure() {
  let a = 10;
  let f = x => {
    return y => {
      return { result: a + x + y, f };
    };
  };

  let out = roundtrip(f(10))(5);
  expect(out.result).to.equal(25);
  expect(out.f(10)(5).result).to.equal(25);
}
