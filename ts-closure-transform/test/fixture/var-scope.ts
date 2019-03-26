function f() {
    do {
        var x = 10;
    } while (false);
    function g() {
        x++;
        return x;
    }
    return g();
}
