let f1 = x => {
    return y => {
      return x * f1(y)(x);
    };
};
