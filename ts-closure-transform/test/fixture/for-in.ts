let x = 10;
let obj = { y: 42 };
(function() {
    for (let x in obj) {
        let f = () => console.log(x);
        f();
    }
})();
function g() {
    x++;
}
