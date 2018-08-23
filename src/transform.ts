import * as ts from 'typescript';

// Inspired by transform.ts from Kris Zyp's ts-transform-safely
// (https://github.com/DoctorEvidence/ts-transform-safely)

/**
 * A set of used, external variables in a chain of such sets.
 */
class CapturedVariableChain {
  /**
   * A list of all captured variables.
   */
  private used: string[];

  /**
   * Creates a captured variable set.
   * @param parent The parent node in the captured variable chain.
   */
  constructor(public parent?: CapturedVariableChain) {
    this.used = [];
  }

  /**
   * Tells if a variable with a particular name is
   * captured by this captured variable set.
   * @param name The name of the variable to check.
   */
  isCaptured(name: string): boolean {
    return this.used.indexOf(name) >= 0;
  }

  /**
   * Hints that the variable with the given name is
   * used by this node in the chain.
   * @param name The name to capture.
   */
  use(name: string): void {
    if (this.isCaptured(name)) {
      return;
    }

    this.used.push(name);
    if (this.parent) {
      this.parent.use(name);
    }
  }
}

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
   * @param parentChain The captured variable chain of the parent function.
   */
  function transformLambda(
    node: ts.ArrowFunction | ts.FunctionExpression,
    parentChain: CapturedVariableChain): ts.VisitResult<ts.Node> {

    // Visit the lambda and extract captured symbols.
    let { visited, captured } = visitAndExtractCapturedSymbols(
      node,
      parentChain);

    return addClosurePropertyToLambda(ctx, visited, captured);
  }

  /**
   * Transforms a function declaration to include a closure property.
   * @param node The node to transform.
   * @param parentChain The captured variable chain of the parent function.
   */
  function transformFunctionDeclaration(
    node: ts.FunctionDeclaration,
    parentChain: CapturedVariableChain): ts.VisitResult<ts.Node> {

    // Visit the function and extract captured symbols.
    let { visited, captured } = visitAndExtractCapturedSymbols(
      node.body,
      parentChain,
      node);

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
   * @param parentChain The captured variable chain of the parent node.
   * @param scopeNode A node that defines the scope from
   * which eligible symbols are extracted.
   */
  function visitAndExtractCapturedSymbols<T extends ts.Node>(
    node: T,
    parentChain: CapturedVariableChain,
    scopeNode?: ts.Node): { visited: T, captured: ts.Symbol[] } {

    scopeNode = scopeNode || node;

    let symbolsInScope = typeChecker.getSymbolsInScope(
      scopeNode.parent,
      ts.SymbolFlags.Variable | ts.SymbolFlags.Function);

    let chain = new CapturedVariableChain(parentChain);

    // Visit the body of the arrow function.
    let visited = ts.visitEachChild(
      node,
      visitor(chain),
      ctx);

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
      if (chain.isCaptured(symbol.name)) {
        captured.push(symbol);
      }
    }

    return { visited, captured }
  }

  /**
   * Creates a visitor.
   * @param captured The captured variable chain to update.
   */
  function visitor(captured: CapturedVariableChain): ts.Visitor {
    return node => {
      if (ts.isIdentifier(node)) {
        captured.use(node.text);
        return node;
      } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return transformLambda(node, captured);
      } else if (ts.isFunctionDeclaration(node)) {
        return transformFunctionDeclaration(node, captured);
      } else {
        return ts.visitEachChild(node, visitor(captured), ctx);
      }
    };
  }

  return visitor(new CapturedVariableChain());
}

export default function (typeChecker: ts.TypeChecker) {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, typeChecker))
  }
}
