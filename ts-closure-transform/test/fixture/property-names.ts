let noCapturePropNames = () => {
    let result = { a: 10 };
    result.a += 10;
    return result;
};

let noCapturePropNames2 = () => {
  return noCapturePropNames().a;
};
