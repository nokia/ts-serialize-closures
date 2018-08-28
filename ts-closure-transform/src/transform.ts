import * as ts from 'typescript';

// Inspired by transform.ts from Kris Zyp's ts-transform-safely
// (https://github.com/DoctorEvidence/ts-transform-safely)

/**
 * A lexical scope data structure that keeps track of captured variables.
 */
class CapturedVariableScope {
  /**
   * A list of all used variable identifiers.
   */
  private used: ts.Identifier[];

  /**
   * A list of all used variable names.
   */
  private usedNames: string[];

  /**
   * A list of all declared variables in the current scope.
   */
  private declared: string[];

  /**
   * Creates a captured variable scope.
   * @param parent The parent node in the captured variable chain.
   */
  constructor(public parent?: CapturedVariableScope) {
    this.used = [];
    this.usedNames = [];
    this.declared = [];
  }

  /**
   * Tells if a variable with a particular name is
   * captured by this scope.
   * @param name The name of the variable to check.
   */
  isCaptured(name: ts.Identifier): boolean {
    return this.usedNames.indexOf(name.text) >= 0;
  }

  /**
   * Tells if a variable with a particular name is
   * declared by this scope.
   * @param name The name of the variable to check.
   */
  isDeclared(name: ts.Identifier): boolean {
    return this.declared.indexOf(name.text) >= 0;
  }

  /**
   * Hints that the variable with the given name is
   * used by this scope.
   * @param name The name to capture.
   */
  use(name: ts.Identifier): void {
    if (this.isCaptured(name) || this.isDeclared(name)) {
      return;
    }

    this.used.push(name);
    this.usedNames.push(name.text);
    if (this.parent) {
      this.parent.use(name);
    }
  }

  /**
   * Hints that the variable with the given name is
   * declared by this scope in the chain.
   * @param name The name to declare.
   */
  declare(name: ts.Identifier): void {
    if (this.isDeclared(name)) {
      return;
    }

    this.declared.push(name.text);
  }

  /**
   * Gets a read-only array containing all captured variables
   * in this scope.
   */
  get captured(): ReadonlyArray<ts.Identifier> {
    return this.used;
  }
}

/**
 * Creates a lambda that can be evaluated to a key-value
 * mapping for captured variables.
 * @param capturedVariables The list of captured variables.
 */
function createClosureLambda(capturedVariables: ReadonlyArray<ts.Identifier>) {
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
      ts.createShorthandPropertyAssignment(variable));
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
  capturedVariables: ReadonlyArray<ts.Identifier>): ts.BinaryExpression {

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
  capturedVariables: ReadonlyArray<ts.Identifier>) {

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
 * Creates a node visitor from a transformation context.
 * @param ctx The transformation context to use.
 */
function visitor(ctx: ts.TransformationContext) {

  /**
   * Transforms an arrow function or function expression
   * to include a closure property.
   * @param node The node to transform.
   * @param parentChain The captured variable chain of the parent function.
   */
  function transformLambda(
    node: ts.ArrowFunction | ts.FunctionExpression,
    parentChain: CapturedVariableScope): ts.VisitResult<ts.Node> {

    let chain = new CapturedVariableScope(parentChain);

    // Declare the function expression's name.
    if (node.name) {
      parentChain.declare(node.name);
      chain.declare(node.name);
    }

    // Declare the function declaration's parameters.
    for (let param of node.parameters) {
      visitDeclaration(param.name, chain);
    }

    // Visit the lambda and extract captured symbols.
    let { visited, captured } = visitAndExtractCapturedSymbols(
      node,
      chain);

    return addClosurePropertyToLambda(ctx, visited, captured);
  }

  /**
   * Transforms a function declaration to include a closure property.
   * @param node The node to transform.
   * @param parentChain The captured variable chain of the parent function.
   */
  function transformFunctionDeclaration(
    node: ts.FunctionDeclaration,
    parentChain: CapturedVariableScope): ts.VisitResult<ts.Node> {

    let chain = new CapturedVariableScope(parentChain);

    // Declare the function declaration's name.
    if (node.name) {
      parentChain.declare(node.name);
      chain.declare(node.name);
    }

    // Declare the function declaration's parameters.
    for (let param of node.parameters) {
      visitDeclaration(param.name, chain);
    }

    // Visit the function and extract captured symbols.
    let { visited, captured } = visitAndExtractCapturedSymbols(
      node.body,
      chain,
      node);

    let visitedFunc = ts.updateFunctionDeclaration(
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
      return visitedFunc;
    } else {
      return [
        visitedFunc,
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
   * @param chain The captured variable chain of the node.
   * @param scopeNode A node that defines the scope from
   * which eligible symbols are extracted.
   */
  function visitAndExtractCapturedSymbols<T extends ts.Node>(
    node: T,
    chain: CapturedVariableScope,
    scopeNode?: ts.Node): { visited: T, captured: ReadonlyArray<ts.Identifier> } {

    scopeNode = scopeNode || node;

    // Visit the body of the arrow function.
    let visited = ts.visitEachChild(
      node,
      visitor(chain),
      ctx);

    // Figure out which symbols are captured and return.
    return { visited, captured: chain.captured }
  }

  function visitDeclaration(declaration: ts.Node, captured: CapturedVariableScope) {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isIdentifier(node)) {
        captured.declare(node);
        return node;
      } else {
        return ts.visitEachChild(node, visit, ctx);
      }
    }

    return visit(declaration);
  }

  /**
   * Creates a visitor.
   * @param captured The captured variable chain to update.
   */
  function visitor(captured: CapturedVariableScope): ts.Visitor {
    function recurse<T extends ts.Node>(node: T): T {
      return <T>visitor(captured)(node);
    }

    return node => {
      if (ts.isIdentifier(node)) {
        if (node.text !== "undefined"
          && node.text !== "null"
          && node.text !== "arguments") {

            captured.use(node);
        }
        return node;
      } else if (ts.isTypeNode(node)) {
        // Don't visit type nodes.
        return node;
      } else if (ts.isPropertyAccessExpression(node)) {
        // Make sure we don't accidentally fool ourselves
        // into visiting property name identifiers.
        return ts.updatePropertyAccess(
          node,
          recurse(node.expression),
          node.name);
      } else if (ts.isQualifiedName(node)) {
        // Make sure we don't accidentally fool ourselves
        // into visiting the right-hand side of a qualified name.
        return ts.updateQualifiedName(
          node,
          recurse(node.left),
          node.right);
      } else if (ts.isPropertyAssignment(node)) {
        // Make sure we don't accidentally fool ourselves
        // into visiting property name identifiers.
        return ts.updatePropertyAssignment(
          node,
          node.name,
          recurse(node.initializer));
      } else if (ts.isVariableDeclaration(node)) {
        visitDeclaration(node.name, captured);
        return ts.visitEachChild(node, visitor(captured), ctx);
      } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return transformLambda(node, captured);
      } else if (ts.isFunctionDeclaration(node)) {
        return transformFunctionDeclaration(node, captured);
      } else {
        return ts.visitEachChild(node, visitor(captured), ctx);
      }
    };
  }

  return visitor(new CapturedVariableScope());
}

export default function() {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx));
  }
}
