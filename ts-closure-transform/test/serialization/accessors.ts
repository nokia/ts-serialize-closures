import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
    return deserialize(serialize(value));
}

export function roundtripObjectWithAccessors() {
    let obj = {
        x: 1,
        get() { return this.x },
        set(x) { this.x = x }
    }
    expect(roundtrip(obj).get()).to.equal(1);
    obj.set(2)
    expect(roundtrip(obj).get()).to.equal(2);
}

export function roundtripObjectWithNamedAccessors() {
    let obj = {
        x: 1,
        get latest() { return this.x },
        set latest(x) { this.x = x }
    }
    expect(roundtrip(obj).latest).to.equal(1);
    obj.latest = 2
    expect(roundtrip(obj).latest).to.equal(2);
}
