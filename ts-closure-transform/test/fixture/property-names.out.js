var _a;
let noCapturePropNames = () => {
    let result = { a: { b: 10 } };
    result.a.b += 10;
    return result;
};
let noCapturePropNames2 = (_a = () => {
    return noCapturePropNames().a.b;
}, _a.__closure = () => ({ noCapturePropNames }), _a);
