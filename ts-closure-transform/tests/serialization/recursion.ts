import { equal, deepEqual } from 'node:assert';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
    return deserialize(serialize(value));
}

export function simpleRecursiveRoundtrip() {
    equal(1, 1);
    equal(roundtrip(1), 1);
    equal(roundtrip(roundtrip(1)), 1);
    equal(roundtrip(roundtrip(roundtrip(1))), 1);
}

export function objectRecursiveRoundtrip() {
    deepEqual({f: 1}, {f: 1});
    deepEqual(roundtrip({f: 1}), {f: 1});
    deepEqual(roundtrip(roundtrip({f: 1})), {f: 1});
    deepEqual(roundtrip(roundtrip(roundtrip({f: 1}))), {f: 1});
}

let to5 = function(x: number) {
    return x < 5 ? to5(x + 1) : x
}

export function functionRecursiveRoundtrip() {
    equal(to5(1), 5);
    equal(roundtrip(to5)(1), 5);
    equal(roundtrip(roundtrip(to5))(1), 5);
    equal(roundtrip(roundtrip(roundtrip(to5)))(1), 5);
}
