import * as ts from 'typescript';

// Inspired by transform.ts from Kris Zyp's ts-transform-safely
// (https://github.com/DoctorEvidence/ts-transform-safely)

/**
 * Adds a closure property to a lambda. Returns
 * an expression that produces the exact same lambda
 * but with the closure property added.
 * @param ctx The transformation context to use.
 * @param lambda The lambda to transform.
 * @param capturedVariables The list of captured variables
 * to put in the closure property.
 */
function addClosurePropertyToLambda(
  ctx: ts.TransformationContext,
  lambda: ts.Expression,
  capturedVariables: ts.Symbol[]) {

  // Tiny optimization: lambdas that don't
  // capture anything don't get a closure property.
  if (capturedVariables.length === 0) {
    return lambda;
  }

  // If we do have captured variables, then we'll
  // construct a closure property.
  let temp = ts.createTempVariable(undefined);
  ctx.hoistVariableDeclaration(temp);

  // Synthesize a lambda that has the following format:
  //
  //     () => { a, b, ... }
  //
  // where a, b, ... is the list of captured variables.
  //
  // First step: create the object literal returned by the lamba.
  let objLiteralElements: ts.ObjectLiteralElementLike[] = [];

  for (let variable of capturedVariables) {
    objLiteralElements.push(
      ts.createShorthandPropertyAssignment(variable.name));
  }

  // Create the lambda itself.
  let closureLambda = ts.createArrowFunction(
    [],
    [],
    [],
    undefined,
    undefined,
    ts.createObjectLiteral(objLiteralElements));

  // Use the comma operator to create an expression that looks
  // like this:
  //
  // (temp = <lambda>, temp.__closure = () => { a, b, ... }, temp)
  return ts.createCommaList([
    ts.createAssignment(temp, lambda),
    ts.createAssignment(
      ts.createPropertyAccess(temp, "__closure"),
      closureLambda),
    temp
  ]);
}

/**
 * Creates a node visitor from a transformation context
 * and a type checker.
 * @param ctx The transformation context to use.
 * @param typeChecker The program's type checker.
 */
function visitor(ctx: ts.TransformationContext, typeChecker: ts.TypeChecker) {

  /**
   * Transforms an arrow function or function expression
   * to include a closure property.
   * @param node The node to transform.
   */
  function transformLambda(
    node: ts.ArrowFunction | ts.FunctionExpression): ts.VisitResult<ts.Node> {

    let symbolsInScope = typeChecker.getSymbolsInScope(
      node.parent,
      ts.SymbolFlags.Variable | ts.SymbolFlags.Function);

    let usedVariables: string[] = [];

    // Visit the body of the arrow function.
    let visitedArrow = ts.visitEachChild(node, arrowVisitor(usedVariables), ctx);

    // Figure out which symbols are captured by intersecting
    // the set of symbols in scope with the set of names used
    // by the arrow function.
    //
    // TODO: compute the set of captured symbols exactly.
    // This is currently a conservative approximation: names that are
    // shadowed are assumed to be captured, but they're really not.
    // We can do better by recording a set of locally declared names in
    // `arrowVisitor`.

    let capturedVariables: ts.Symbol[] = [];
    for (let symbol of symbolsInScope) {
      if (usedVariables.indexOf(symbol.name) >= 0) {
        capturedVariables.push(symbol);
      }
    }

    return addClosurePropertyToLambda(ctx, visitedArrow, capturedVariables);
  }

  /**
   * Creates an arrow function visitor that populates an array of used
   * variables.
   * @param usedVariables An array of used variables to populate with
   * all identifiers in visited nodes.
   */
  function arrowVisitor(usedVariables: string[]): ts.Visitor {
    return node => {
      if (ts.isIdentifier(node)) {
        usedVariables.push(node.text);
        return ts.visitEachChild(node, arrowVisitor(usedVariables), ctx);
      } else {
        return ts.visitEachChild(node, arrowVisitor(usedVariables), ctx);
      }
    };
  }

  /**
   * Visits a node.
   * @param node The node to visit.
   */
  function visitor(node: ts.Node): ts.VisitResult<ts.Node> {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      return transformLambda(node);
    } else {
      return ts.visitEachChild(node, visitor, ctx);
    }
  }

  return visitor;
}

export default function (typeChecker: ts.TypeChecker) {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, typeChecker))
  }
}
