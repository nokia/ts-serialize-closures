function f() {
    return 12;
}
function g() {
    return f();
}
g.__closure = () => ({ f });
