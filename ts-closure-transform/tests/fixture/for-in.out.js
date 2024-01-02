function g() {
    ++x.value;
}
var _tct_transform_1;
g.__closure = () => ({ x });
let x = { value: undefined };
x.value = 10;
let obj = { y: 42 };
(_tct_transform_1 = function () {
    var _tct_transform_2;
    for (let x in obj) {
        let f = (_tct_transform_2 = () => console.log(x), _tct_transform_2.__closure = () => ({ console, x }), _tct_transform_2);
        f();
    }
}, _tct_transform_1.__closure = () => ({ obj, console }), _tct_transform_1)();
