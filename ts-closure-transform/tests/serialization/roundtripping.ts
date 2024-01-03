import { equal, deepEqual } from 'node:assert';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

export function roundTripObjectPropertyValueShorthand() {
  let createPoint = (x, y) => {
    return {
      x,
      y
    }
  }
  deepEqual(roundtrip(createPoint)(1, 2), { x: 1, y: 2 });
}

export function roundTripObjectPropertyValueShorthand2() {
  let f = v => {
    let vs: any[] = []
    vs.push({v});
    return vs;
  }
  let f2 = roundtrip(f);
  deepEqual(f2(1), [{ v: 1 }]);
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

  equal(roundtrip(factorial)(5), 120);
}

export function roundTripHoistingClosure() {
  let f = x => {
    let a = 1;
    let r = curriedAdd(x);
    function curriedAdd(x) {
      return a + x;
    }
    return r;
  };

  let out = roundtrip(f);
  equal(out(4), 5);
}

export function roundTripHoistingClosure2() {
  let f = () => {
    let a = 1;
    return curriedAdd;
    function curriedAdd(x) {
      return a + x;
    }
  };

  let out = roundtrip(f());
  equal(out(4), 5);
}

export function roundTripHoistingClosure3() {
  let f = () => {
    const a = 1;
    const f = (v: number) => v + a
    return curriedAdd;
    function curriedAdd(x) {
      return f(x);
    }
  };

  let out = roundtrip(f());
  equal(out(4), 5);
}

export function roundTripNestedClosure() {
  let a = 10;
  let f = x => {
    return y => {
      return { result: a + x + y, f };
    };
  };

  let out = roundtrip(f(10))(5);
  equal(out.result, 25);
  equal(out.f(10)(5).result, 25);
}

export function roundTripMathClosure() {
  let f = x => {
    return Math.sqrt(x);
  };

  let out = roundtrip(f);
  equal(out(4), 2);
}

export function roundTripMathFunctionClosure() {
  let sqrt = Math.sqrt;
  let f = x => {
    return sqrt(x);
  };

  let out = roundtrip(f);
  equal(out(4), 2);
}
