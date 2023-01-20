var _tct_transform_1;
let noCapturePropNames = () => {
    let result = { a: { b: 10 } };
    result.a.b += 10;
    return result;
};
let noCapturePropNames2 = (_tct_transform_1 = () => {
    return noCapturePropNames().a.b;
}, _tct_transform_1.__closure = () => ({ noCapturePropNames }), _tct_transform_1);
