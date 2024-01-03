import { equal, deepEqual, notEqual } from 'node:assert';
import { deserialize, serialize, BuiltinList, generateDefaultBuiltins } from '../src';
import * as vm from 'vm';
import { CustomSerializerList, CustomSerializerRecord, CustomDeserializerRecord, CustomDeserializerList } from '../src/customs';

describe('Roundtripping', () => {
  function roundtrip(value, builtins?: BuiltinList, customSerializers?: CustomSerializerList, customDeserializers?: CustomDeserializerList) {
    return deserialize(JSON.parse(JSON.stringify(serialize(value, builtins, customSerializers))), builtins, customDeserializers);
  }

  function expectRoundtrip(value, builtins?: BuiltinList) {
    deepEqual(roundtrip(value, builtins), value);
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

  it("can round-trip shorthand objects", () => {
    let hi = 'hi';
    expectRoundtrip({ hi });
  });

  it("can round-trip class-like objects", () => {
    let obj = {};
    Object.defineProperty(obj, 'hi', { get: () => 'there' });
    equal(roundtrip(obj).hi, 'there');
  });

  it("can round-trip dates", () => {
    expectRoundtrip(new Date("Thu, 28 Apr 2016 22:02:17 GMT"));
  });

  it("can round-trip regexes", () => {
    expectRoundtrip(/([^\s]+)/g);
  });

  it("can round-trip functions without closures", () => {
    equal(
      roundtrip(function (x) { return x; })(10),
      10);
  });

  it("can round-trip functions with closures", () => {
    let a = 10;
    let f: any = function (x) { return a + x; };
    f.__closure = () => ({ a });

    equal(roundtrip(f)(42), 52);
  });

  it("can round-trip recursive functions", function () {
    let f: any = function (x) { return x < 5 ? f(x + 1) : x; };
    f.__closure = function () { return ({ f }); };
    equal(roundtrip(f)(1), 5);
  });

  it("can round-trip accessors in objects", () => {
    let obj = {
      x: 'there',
      get() { return this.x }
    };
    equal(roundtrip(obj).get(), 'there');
  });

  it("can round-trip named accessors in objects", () => {
    let obj = {
      x: 'there',
      get hi() { return this.x }
    };
    equal(roundtrip(obj).hi, 'there');
  });

  it("can round-trip builtins", () => {
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
    equal(roundtrip(builder)().lengthSquared(), 25);
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

    equal(roundtrip(create)().toString(), create().toString());
  });

  it("can round-trip custom builtins", () => {
    let myBuiltin = { value: "Oh hi Mark!" };
    equal(
      roundtrip(
        myBuiltin,
        [{ name: "myBuiltin", builtin: myBuiltin }]),
      myBuiltin);
  });

  it("works with vm.runInContext", () => {
    let context = vm.createContext();
    let evalImpl = code => vm.runInContext(code, context);
    let box = evalImpl('{ value: "Oh hi Mark!" }');
    let builtins = generateDefaultBuiltins(undefined, evalImpl);
    let roundtrippedBox = roundtrip(box, builtins);
    deepEqual(roundtrippedBox, box);
    deepEqual(
      Object.getPrototypeOf(roundtrippedBox),
      Object.getPrototypeOf(box)
    );
  });

  it("elides twice-underscore-prefixed properties", () => {
    deepEqual(roundtrip({ "__elide_this": 10 }), { });
  });

  it("accepts a custom `eval` implementation", () => {
    // This test serializes an object in the current context,
    // then creates a new context and deserializes the object
    // in that context. This represents the use-case of serializing
    // objects in one sandbox and deserializing them in another.
    let createBox = () => ({ value: "Oh hi Mark!" });
    let serialized = serialize(createBox);

    let context = vm.createContext({ generateDefaultBuiltins });
    let evalImpl = code => vm.runInContext(code, context);
    let builtins = evalImpl('generateDefaultBuiltins()');
    let deserializedBox = deserialize(serialized, builtins, [], evalImpl)();
    deepEqual(deserializedBox, createBox());
    // Prototypes should be different because they originate
    // from different environments.
    notEqual(Object.getPrototypeOf(deserializedBox), Object.getPrototypeOf(createBox()));
    equal(Object.getPrototypeOf(deserializedBox), evalImpl("Object.prototype"));
  });

  it("can round-trip custom serializer", () => {
    // This test serializes an object using a custom serializer.
    // The goal is to deserialize the object using a mapping to the custom deserializer.
    let myValue = { value: "Oh hi Mark!" };
    let serializer: CustomSerializerRecord = {
      name: "mark-serializer",
      value: myValue,
      serializer: () => {
        return "My-JSON: " + JSON.stringify(myValue);
      },
    };
    let deserializer: CustomDeserializerRecord = {
      name: "mark-serializer",
      deserializer: (str: string) => {
        let stripped = str.substring("My-JSON: ".length);
        return JSON.parse(stripped);
      },
    };
    equal(
      JSON.stringify(roundtrip(myValue, [], [serializer], [deserializer])),
      JSON.stringify(myValue)
    );
  });
});
