import { equal } from 'node:assert';
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
    equal(roundtrip(obj).get(), 1);
    obj.set(2)
    equal(roundtrip(obj).get(), 2);
}

export function roundtripObjectWithNamedAccessors() {
    let obj = {
        x: 1,
        get latest() { return this.x },
        set latest(x) { this.x = x }
    }
    equal(roundtrip(obj).latest, 1);
    obj.latest = 2
    equal(roundtrip(obj).latest, 2);
}
