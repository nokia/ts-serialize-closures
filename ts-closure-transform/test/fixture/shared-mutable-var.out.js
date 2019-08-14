var _a, _b;
function createCounter() {
    let count = { value: undefined };
    count.value = 0;
    return {
        get: (_a = () => count.value, _a.__closure = () => ({ count }), _a),
        increment: (_b = () => { ++count.value; }, _b.__closure = () => ({ count }), _b)
    };
}
