var _a;
let x = { value: undefined };
x.value = 10;
let obj = { y: 42 };
(_a = function () {
    var _a;
    for (let x in obj) {
        let f = (_a = () => console.log(x), _a.__closure = () => ({ console, x }), _a);
        f();
    }
}, _a.__closure = () => ({ obj, console }), _a)();
function g() {
    ++x.value;
}
g.__closure = () => ({ x });
