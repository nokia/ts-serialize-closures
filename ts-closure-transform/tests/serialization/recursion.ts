import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
    return deserialize(serialize(value));
}

export function simpleRecursiveRoundtrip() {
    expect(1).to.equal(1);
    expect(roundtrip(1)).to.equal(1);
    expect(roundtrip(roundtrip(1))).to.equal(1);
    expect(roundtrip(roundtrip(roundtrip(1)))).to.equal(1);
}

export function objectRecursiveRoundtrip() {
    expect({f: 1}).to.deep.equal({f: 1});
    expect(roundtrip({f: 1})).to.deep.equal({f: 1});
    expect(roundtrip(roundtrip({f: 1}))).to.deep.equal({f: 1});
    expect(roundtrip(roundtrip(roundtrip({f: 1})))).to.deep.equal({f: 1});
}

let to5 = function(x: number) {
    return x < 5 ? to5(x + 1) : x
}

export function functionRecursiveRoundtrip() {
    expect(to5(1)).to.equal(5);
    expect(roundtrip(to5)(1)).to.equal(5);
    expect(roundtrip(roundtrip(to5))(1)).to.equal(5);
    expect(roundtrip(roundtrip(roundtrip(to5)))(1)).to.equal(5);
}
