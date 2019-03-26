function f() {
    do {
        var x = { value: undefined };
        x.value = 10;
    } while (false);
    function g() {
        ++x.value;
        return x.value;
    }
    g.__closure = () => ({ x });
    return g();
}
