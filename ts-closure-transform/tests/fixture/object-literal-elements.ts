let objLiteral = {
    get content() {
        return 10;
    },
    set content(value) {
    },
    value: function getValue() {
        var content = this.content;
        content = function() {
            return content();
        };
        return content();
    },
    getValue() {
        return this.content;
    }
};
