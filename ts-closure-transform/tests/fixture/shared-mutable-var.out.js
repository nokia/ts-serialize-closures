var _tct_transform_1, _tct_transform_2;
function createCounter() {
    let count = { value: undefined };
    count.value = 0;
    return {
        get: (_tct_transform_1 = () => count.value, _tct_transform_1.__closure = () => ({ count }), _tct_transform_1),
        increment: (_tct_transform_2 = () => { ++count.value; }, _tct_transform_2.__closure = () => ({ count }), _tct_transform_2)
    };
}
