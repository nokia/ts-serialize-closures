let objLiteral = {
    get content() {
        return 10;
    },
    set content(value) {
    },
    value: function getValue() {
        var _a;
        var content = { value: undefined };
        content.value = this.content;
        content.value = (_a = function () {
            return content.value();
        }, _a.__closure = () => ({ content }), _a);
        return content.value();
    },
    getValue() {
        return this.content;
    }
};
