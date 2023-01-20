let objLiteral = {
    get content() {
        return 10;
    },
    set content(value) {
    },
    value: function getValue() {
        var _tct_transform_1;
        var content = { value: undefined };
        content.value = this.content;
        content.value = (_tct_transform_1 = function () {
            return content.value();
        }, _tct_transform_1.__closure = () => ({ content }), _tct_transform_1);
        return content.value();
    },
    getValue() {
        return this.content;
    }
};
