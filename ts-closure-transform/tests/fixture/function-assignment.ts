function f() {
    return 2;
}

function g() {
    f = () => 4;
    return;
}

function h() {
    return f();
}
