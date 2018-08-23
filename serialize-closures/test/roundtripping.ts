import { expect } from 'chai';
import { deserialize, serialize } from '../src';

describe('Roundtripping', () => {
  function roundtrip(value) {
    return deserialize(JSON.parse(JSON.stringify(serialize(value))));
  }
  
  function expectRoundtrip(value) {
    expect(roundtrip(value)).to.deep.equal(value);
  }

  it("can round-trip primitives", () => {
    expectRoundtrip(10);
    expectRoundtrip("hi");
    expectRoundtrip(null);
    expectRoundtrip(undefined);
    expectRoundtrip(true);
  });

  it("can round-trip arrays of primitives", () => {
    expectRoundtrip([10, 40]);
    expectRoundtrip(["hi"]);
    expectRoundtrip([null]);
    expectRoundtrip([undefined]);
    expectRoundtrip([true]);
  });

  it("can round-trip simple objects", () => {
    expectRoundtrip({ 'hi': 'there' });
  });

  it("can round-trip functions without closures", () => {
    expect(
      roundtrip(function (x) { return x; })(10))
      .to.equal(10);
  });

  it("can round-trip functions with closures", () => {
    let a = 10;
    let f: any = function (x) { return a + x; };
    f.__closure = () => ({ a });

    expect(roundtrip(f)(42)).to.equal(52);
  });
});
