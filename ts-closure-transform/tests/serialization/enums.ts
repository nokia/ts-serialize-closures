import { equal } from 'node:assert';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
    return deserialize(serialize(value));
}

export enum Match {
    CONTAINS = "CONTAINS",
    CROSSES = "CROSSES",
    DISJOINT = "DISJOINT"
}

export function enumString() {
    equal(roundtrip(Match.CROSSES), "CROSSES");
}
