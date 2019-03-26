var f = { value: undefined };
f.value = function () {
    return 2;
};
function g() {
    f.value = () => 4;
    return;
}
g.__closure = () => ({ f });
function h() {
    return f.value();
}
h.__closure = () => ({ f });
