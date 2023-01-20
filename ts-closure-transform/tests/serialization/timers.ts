import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
    return deserialize(serialize(value));
}

export async function roundtripWithTimeout() {
    let delay = 10;
    let v = {
        value: 0,
        delayIncr: () => {
            setTimeout(() => v.value++, delay);
        }
    };
    let vt = roundtrip(v);
    expect(vt.value).to.equal(0);
    vt.delayIncr();
    await new Promise((resolve, reject) => setTimeout(resolve, delay * 2));
    expect(vt.value).to.equal(1);
    expect(v.value).to.equal(0);
}

export async function roundtripWithCancelledTimeout() {
    let delay = 10;
    let v = {
        value: 0,
        delayIncr: () => {
            let t = setTimeout(() => v.value++, delay);
            clearTimeout(t);
        }
    };
    let vt = roundtrip(v);
    expect(vt.value).to.equal(0);
    vt.delayIncr();
    await new Promise((resolve, reject) => setTimeout(resolve, delay * 2));
    expect(vt.value).to.equal(0);
    expect(v.value).to.equal(0);
}

export async function roundtripWithTimeoutPromise() {
    let v = {
        value: 0,
        delayIncr: () => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(v.value + 1);
                }, 10);
            });
        }
    }
    let vt = roundtrip(v);
    expect(vt.value).to.equal(0);
    let vtn = await v.delayIncr();
    expect(vt.value).to.equal(0);
    expect(v.value).to.equal(0);
    expect(vtn).to.equal(1);
}
