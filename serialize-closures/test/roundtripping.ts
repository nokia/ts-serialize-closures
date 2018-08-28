import { expect } from 'chai';
import { deserialize, serialize, BuiltinList } from '../src';

describe('Roundtripping', () => {
  function roundtrip(value, builtins?: BuiltinList) {
    return deserialize(JSON.parse(JSON.stringify(serialize(value, builtins))), builtins);
  }
  
  function expectRoundtrip(value, builtins?: BuiltinList) {
    expect(roundtrip(value, builtins)).to.deep.equal(value);
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

  it("can round-trip class-like objects", () => {
    let obj = {};
    Object.defineProperty(obj, 'hi', { get: () => 'there' });
    expect(roundtrip(obj).hi).to.equal('there');
  });

  it("can round-trip dates", () => {
    expectRoundtrip(new Date("Thu, 28 Apr 2016 22:02:17 GMT"));
  });

  it("can round-trip regexes", () => {
    expectRoundtrip(/([^\s]+)/g);
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

  it("can roundtrip builtins", () => {
    expectRoundtrip(Math);
  });

  it("can round-trip constructors", () => {
    function Vector2(x, y) {
      this.x = x;
      this.y = y;
    }
    Vector2.prototype.lengthSquared = function() { return this.x * this.x + this.y * this.y; };
    let builder: any = () => new Vector2(3, 4);
    builder.__closure = () => ({ Vector2 });
    expect(roundtrip(builder)().lengthSquared()).to.equal(25);
  });

  it("can round-trip static methods", () => {
    var Person = /** @class */ (function () {
        var _a;
        var Person: any = function (name, email) {
            this.name = name;
            this.email = email;
        }
        Person.prototype.toString = function () {
            return this.name + " <" + this.email + ">";
        };
        Person.create = (_a = function (name, email) {
            return new Person(name, email);
        }, _a.__closure = () => ({ Person }), _a);
        return Person;
    }());

    var create: any = function () { return Person.create("Clark Kent", "clark.kent@gmail.com"); };
    create.__closure = () => ({ Person });

    expect(roundtrip(create)().toString()).to.equal(create().toString());
  });

  it("can roundtrip custom builtins", () => {
    let myBuiltin = { value: "Oh hi Mark!" };
    expect(
      roundtrip(
        myBuiltin,
        [{ name: "myBuiltin", builtin: myBuiltin }]))
      .to.equal(myBuiltin);
  });
});
