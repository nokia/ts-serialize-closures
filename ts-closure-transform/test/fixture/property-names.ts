let noCapturePropNames = () => {
    let result = { a: { b: 10 } };
    result.a.b += 10;
    return result;
};

let noCapturePropNames2 = () => {
  return noCapturePropNames().a.b;
};
