import * as ts from 'typescript';

// Inspired by transform.ts from Kris Zyp's ts-transform-safely
// (https://github.com/DoctorEvidence/ts-transform-safely)

/**
 * Creates a lambda that can be evaluated to a key-value
 * mapping for captured variables.
 * @param capturedVariables The list of captured variables.
 */
function createClosureLambda(capturedVariables: ts.Symbol[]) {
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
  return ts.createArrowFunction(
    [],
    [],
    [],
    undefined,
    undefined,
    ts.createObjectLiteral(objLiteralElements));
}

/**
 * Creates an expression that produces a closure lambda
 * and assigns it to the closure property.
 * @param closureFunction The function whose closure property
 * is to be set.
 * @param capturedVariables The list of captured variables to
 * include in the closure lambda.
 */
function createClosurePropertyAssignment(
  closureFunction: ts.Expression,
  capturedVariables: ts.Symbol[]): ts.BinaryExpression {

  return ts.createAssignment(
    ts.createPropertyAccess(closureFunction, "__closure"),
    createClosureLambda(capturedVariables));
}

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

  // Use the comma operator to create an expression that looks
  // like this:
  //
  // (temp = <lambda>, temp.__closure = () => { a, b, ... }, temp)
  return ts.createCommaList([
    ts.createAssignment(temp, lambda),
    createClosurePropertyAssignment(temp, capturedVariables),
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

    // Visit the lambda and extract captured symbols.
    let { visited, captured } = visitAndExtractCapturedSymbols(node);

    return addClosurePropertyToLambda(ctx, visited, captured);
  }

  /**
   * Transforms a function declaration to include a closure property.
   * @param node The node to transform.
   */
  function transformFunctionDeclaration(
    node: ts.FunctionDeclaration): ts.VisitResult<ts.Node> {

    // Visit the function and extract captured symbols.
    let { visited, captured } = visitAndExtractCapturedSymbols(node.body, node);

    // Create an updated function declaration.
    let funcDecl = ts.updateFunctionDeclaration(
      node,
      node.decorators,
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.typeParameters,
      node.parameters,
      node.type,
      visited);

    if (captured.length === 0) {
      return funcDecl;
    }
    else {
      return [
        funcDecl,
        ts.createStatement(
          createClosurePropertyAssignment(
            node.name,
            captured))
      ];
    }
  }

  /**
   * Visits a node and extracts all used identifiers.
   * @param node The node to visit.
   * @param scopeNode A node that defines the scope from
   * which eligible symbols are extracted.
   */
  function visitAndExtractCapturedSymbols<T extends ts.Node>(
    node: T,
    scopeNode?: ts.Node): { visited: T, captured: ts.Symbol[] } {

    scopeNode = scopeNode || node;

    let symbolsInScope = typeChecker.getSymbolsInScope(
      scopeNode.parent,
      ts.SymbolFlags.Variable | ts.SymbolFlags.Function);

    let usedVariables: string[] = [];

    // Visit the body of the arrow function.
    let visited = ts.visitEachChild(node, arrowVisitor(usedVariables), ctx);

    // Figure out which symbols are captured by intersecting
    // the set of symbols in scope with the set of names used
    // by the arrow function.
    //
    // TODO: compute the set of captured symbols exactly.
    // This is currently a conservative approximation: names that are
    // shadowed are assumed to be captured, but they're really not.
    // We can do better by recording a set of locally declared names in
    // `arrowVisitor`.

    let captured: ts.Symbol[] = [];
    for (let symbol of symbolsInScope) {
      if (usedVariables.indexOf(symbol.name) >= 0) {
        captured.push(symbol);
      }
    }

    return { visited, captured }
  }

  /**
   * Creates an node visitor that populates an array of used
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
    } else if (ts.isFunctionDeclaration(node)) {
      return transformFunctionDeclaration(node);
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
