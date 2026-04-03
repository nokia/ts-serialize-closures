let x = 10;
const obj = { y: 42 };
(function () {
    for (const x in obj) {
        const f = () => console.log(x);
        f();
    }
})();

function g() {
    x++;
}
