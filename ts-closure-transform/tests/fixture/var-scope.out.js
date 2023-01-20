function f() {
    function g() {
        ++x.value;
        return x.value;
    }
    g.__closure = () => ({ x });
    do {
        var x = { value: undefined };
        x.value = 10;
    } while (false);
    return g();
}
