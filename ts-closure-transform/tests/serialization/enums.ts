import { expect } from 'chai';
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
    expect(roundtrip(Match.CROSSES)).to.equal("CROSSES");
}
