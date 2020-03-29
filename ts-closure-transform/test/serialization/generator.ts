import { expect } from 'chai';
import { serialize, deserialize, generateDefaultBuiltins } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
    let builtins = generateDefaultBuiltins()
    builtins = builtins.concat([
        { name: "globalThis", builtin: globalThis }
    ])
    return deserialize(serialize(value, builtins), builtins);
}

export function* myGenerator() {
    yield 42;
    yield 84;
}

export function simpleGenerator() {
    expect(myGenerator().next()).to.deep.equal({ value: 42, done: false });
}

export function roundtripGeneratorConstructor() {
    expect(roundtrip(myGenerator)().next()).to.deep.equal({ value: 42, done: false });
}

export function roundtripGeneratorInProgress() {
    let orig = myGenerator();

    let gen = roundtrip(orig);
    expect(gen.next()).to.deep.equal({ value: 42, done: false });
    gen = roundtrip(gen);
    expect(gen.next()).to.deep.equal({ value: 84, done: false });
    gen = roundtrip(gen);
    expect(gen.next()).to.deep.equal({ value: undefined, done: true });

    expect(orig.next()).to.deep.equal({ value: 42, done: false });
    expect(orig.next()).to.deep.equal({ value: 84, done: false });
    expect(orig.next()).to.deep.equal({ value: undefined, done: true });
}

var __generator = function (thisArg, body) {
    var _ : any = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
globalThis.__generator = __generator
