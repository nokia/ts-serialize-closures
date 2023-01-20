
import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

export function roundTripBasicWith() {
  let env = { counter: 10 };

  let f;
  with (env) {
    f = () => {
      return ++counter;
    };
  }

  let out = roundtrip(f);
  expect(out()).to.equal(11);
  expect(out()).to.equal(12);
}

// If uncommented, the assertions below will fail because FlashFreeze assumes
// that all unqualified names refer to variables, an assumption that is invalidated
// by this particular use of the 'with' statement. This is unfortunate, but
// 'with' is deprecated anyway.
/*
class Counter
{
  private c: number;

  constructor()
  {
    this.c = 0;
  }

  get currentCount(): number {
    return this.c++;
  }
}

export function roundTripPropertyWith() {
  let env = new Counter();

  let f;
  with (env) {
    f = () => {
      return currentCount;
    };
  }

  let out = roundtrip(f);
  expect(out()).to.equal(0);
  expect(out()).to.equal(1);
}
*/
