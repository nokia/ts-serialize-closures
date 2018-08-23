var _a;
let noCapturePropNames = () => {
    let result = { a: 10 };
    result.a += 10;
    return result;
};
let noCapturePropNames2 = (_a = () => {
    return noCapturePropNames().a;
}, _a.__closure = () => ({ noCapturePropNames }), _a);
