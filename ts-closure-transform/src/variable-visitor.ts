import * as ts from 'typescript';

/**
 * The type of a unique variable identifier.
 */
export type VariableId = number;

/**
 * A scope data structure that assigns a unique id to each variable.
 */
class VariableNumberingScope {
  private readonly localVariables: { [name: string]: VariableId };
  private readonly parent: VariableNumberingScope | undefined;
  private readonly counter: { value: number };

  /**
   * Creates a variable numbering scope.
   * @param parent A parent scope.
   */
  constructor(parent?: VariableNumberingScope) {
    this.localVariables = {};
    this.parent = parent;
    if (parent) {
      this.counter = parent.counter;
    } else {
      this.counter = { value: 0 };
    }
  }

  /**
   * Defines a variable with a particular name in
   * the current scope.
   * @param name The name of the variable to define.
   */
  public define(name: string): VariableId {
    let newId = this.counter.value++;
    this.localVariables[name] = newId;
    return newId;
  }

  /**
   * Gets the identifier for a variable with a
   * particular name in the current scope.
   * @param name The name of the variable.
   */
  public getId(name: string): VariableId {
    if (name in this.localVariables) {
      // If the name is defined in the local variables,
      // then just grab its id.
      return this.localVariables[name];
    } else if (this.parent) {
      // If the scope has a parent and the name is not defined
      // as a local variable, then defer to the parent.
      return this.parent.getId(name);
    } else {
      // Otherwise, "define" the name as a global.
      return this.define(name);
    }
  }
}

/**
 * A base class for visitors that visit variable uses and
 * definitions.
 */
export abstract class VariableVisitor {
  /**
   * The scope the variable visitor is currently in.
   */
  private scope: VariableNumberingScope;

  /**
   * The transformation context.
   */
  readonly ctx: ts.TransformationContext;

  /**
   * Creates a variable visitor.
   * @param ctx The visitor's transformation context.
   */
  constructor(ctx: ts.TransformationContext) {
    this.ctx = ctx;
    this.scope = new VariableNumberingScope();
  }

  /**
   * Visits a simple use of a variable.
   * @param node The variable use to visit.
   * @param id The variable's identifier.
   */
  protected abstract visitUse(node: ts.Identifier, id: VariableId): ts.Expression;

  /**
   * Visits a variable definition.
   * @param node The name of the variable.
   * @param id The variable's identifier.
   * @returns An optional initial value for the definition.
   */
  protected abstract visitDef(node: ts.Identifier, id: VariableId): undefined | ts.Expression;

  /**
   * Visits an expression that assigns a value to
   * a variable.
   * @param name The name of the variable. 
   * @param id The variable's identifier.
   * @returns A function that rewrites the assignment
   * to the variable if said assignment should
   * be rewritten; otherwise, `undefined`.
   */
  protected abstract visitAssignment(
    name: ts.Identifier,
    id: VariableId): undefined | ((assignment: ts.BinaryExpression) => ts.Expression);

  /**
   * Visits an expression node.
   * @param node The expression node to visit.
   */
  protected visitExpression(node: ts.Expression): ts.Expression {
    return <ts.Expression>this.visit(node);
  }

  /**
   * Visits a particular node.
   * @param node The node to visit.
   */
  visit(node: ts.Node): ts.VisitResult<ts.Node> {
    if (node === undefined) {
      return undefined;

    }
    // Expressions
    else if (ts.isIdentifier(node)) {
      return this.visitUse(node, this.scope.getId(node.text));

    } else if (ts.isPropertyAccessExpression(node)) {
      return ts.updatePropertyAccess(
        node,
        this.visitExpression(node.expression),
        node.name);

    } else if (ts.isPropertyAssignment(node)) {
      return ts.updatePropertyAssignment(
        node,
        node.name,
        this.visitExpression(node.initializer));

    } else if (ts.isShorthandPropertyAssignment(node)) {
      return ts.updateShorthandPropertyAssignment(
        node,
        node.name,
        this.visitExpression(node.objectAssignmentInitializer));

    } else if (ts.isBinaryExpression(node)) {
      return this.visitBinaryExpression(node);

    } else if (ts.isPrefixUnaryExpression(node)
      && (node.operator === ts.SyntaxKind.PlusPlusToken
        || node.operator === ts.SyntaxKind.MinusMinusToken)) {
      return this.visitPreUpdateExpression(node);

    } else if (ts.isPostfixUnaryExpression(node)
      && (node.operator === ts.SyntaxKind.PlusPlusToken
        || node.operator === ts.SyntaxKind.MinusMinusToken)) {
      return this.visitPostUpdateExpression(node);

    }
    // Statements
    else if (ts.isVariableStatement(node)) {
      return this.visitVariableStatement(node);

    } else {
      let oldScope = this.scope;
      this.scope = new VariableNumberingScope(oldScope);
      let result = this.visitChildren(node);
      this.scope = oldScope;
      return result;
    }
  }

  private visitChildren<T extends ts.Node>(node: T): T {
    return ts.visitEachChild(node, n => this.visit(n), this.ctx);
  }

  /**
   * Visits a binary expression.
   * @param node The expression to visit.
   */
  private visitBinaryExpression(node: ts.BinaryExpression): ts.Expression {
    let lhs = node.left;
    if (ts.isIdentifier(lhs)) {
      // Syntax we'd like to handle: identifier [+,-,*,/,...]= rhs;
      let id = this.scope.getId(lhs.text);

      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        let visited = ts.updateBinary(
          node,
          lhs,
          this.visitExpression(node.right),
          node.operatorToken);  
        let rewrite = this.visitAssignment(lhs, id);
        if (rewrite) {
          return rewrite(visited);
        } else {
          return visited;
        }
      } else if (node.operatorToken.kind in VariableVisitor.noAssignmentMapping) {
        let rewrite = this.visitAssignment(lhs, id);
        if (rewrite) {
          return rewrite(
            ts.updateBinary(
              node,
              lhs,
              ts.createBinary(
                this.visitUse(lhs, id),
                VariableVisitor.noAssignmentMapping[node.operatorToken.kind],
                this.visitExpression(node.right)),
              ts.createToken(ts.SyntaxKind.EqualsToken)));
        } else {
          return ts.updateBinary(
            node,
            lhs,
            this.visitExpression(node.right),
            node.operatorToken);
        }
      }
      return this.visitChildren(node);
    } else {
      return this.visitChildren(node);
    }
  }

  private static noAssignmentMapping = {
    [ts.SyntaxKind.PlusEqualsToken]: ts.SyntaxKind.PlusToken,
    [ts.SyntaxKind.MinusEqualsToken]: ts.SyntaxKind.MinusToken,
    [ts.SyntaxKind.AsteriskEqualsToken]: ts.SyntaxKind.AsteriskToken,
    [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: ts.SyntaxKind.AsteriskAsteriskToken,
    [ts.SyntaxKind.SlashEqualsToken]: ts.SyntaxKind.SlashToken,
    [ts.SyntaxKind.PercentEqualsToken]: ts.SyntaxKind.PercentToken,
    [ts.SyntaxKind.LessThanLessThanEqualsToken]: ts.SyntaxKind.LessThanLessThanToken,
    [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ts.SyntaxKind.GreaterThanGreaterThanToken,
    [ts.SyntaxKind.AmpersandEqualsToken]: ts.SyntaxKind.AmpersandToken,
    [ts.SyntaxKind.BarEqualsToken]: ts.SyntaxKind.BarToken,
    [ts.SyntaxKind.CaretEqualsToken]: ts.SyntaxKind.CaretToken,
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
  };

  /**
   * Visits a pre-increment or pre-decrement expression.
   * @param expression The expression to visit.
   */
  private visitPreUpdateExpression(expression: ts.PrefixUnaryExpression): ts.Expression {
    if (ts.isIdentifier(expression.operand)) {
      let id = this.scope.getId(expression.operand.text);
      let rewrite = this.visitAssignment(expression.operand, id);
      if (rewrite) {
        // Rewrite pre-increment and pre-decrement updates by desugaring them and
        // then rewriting the desugared version.
        let use = this.visitUse(expression.operand, id);
        let value = expression.operator === ts.SyntaxKind.PlusPlusToken
          ? ts.createAdd(use, ts.createLiteral(1))
          : ts.createSubtract(use, ts.createLiteral(1));

        return rewrite(
          ts.createAssignment(
            expression.operand,
            value));
      } else {
        return expression;
      }
    } else {
      return this.visitChildren(expression);
    }
  }

  /**
   * Visits a post-increment or post-decrement expression.
   * @param expression The expression to visit.
   */
  private visitPostUpdateExpression(expression: ts.PostfixUnaryExpression): ts.Expression {
    if (ts.isIdentifier(expression.operand)) {
      let id = this.scope.getId(expression.operand.text);
      let rewrite = this.visitAssignment(expression.operand, id);
      if (rewrite) {
        // Rewrite post-increment and post-decrement updates by desugaring them and
        // then rewriting the desugared version.
        let firstUse = this.visitUse(expression.operand, id);
        let secondUse = this.visitUse(expression.operand, id);
        let temp = this.createTempVariable();
        let value = expression.operator === ts.SyntaxKind.PlusPlusToken
          ? ts.createAdd(secondUse, ts.createLiteral(1))
          : ts.createSubtract(secondUse, ts.createLiteral(1));

        return ts.createCommaList(
          [
            ts.createAssignment(
              temp,
              firstUse),
            ts.createAssignment(
              expression.operand,
              rewrite(value)),
            temp
          ]);
      } else {
        return expression;
      }
    } else {
      return this.visitChildren(expression);
    }
  }

  /**
   * Defines all variable in a binding name.
   * @param name A binding name.
   */
  private defineVariables(name: ts.BindingName) {
    if (ts.isIdentifier(name)) {
      this.scope.define(name.text);
    } else if (ts.isArrayBindingPattern(name)) {
      for (let elem of name.elements) {
        if (ts.isBindingElement(elem)) {
          this.defineVariables(elem.name);
        }
      }
    } else {
      for (let elem of name.elements) {
        this.defineVariables(elem.name);
      }
    }
  }

  /**
   * Visits a variable statement.
   * @param statement The statement to visit.
   */
  private visitVariableStatement(statement: ts.VariableStatement): ts.VisitResult<ts.Statement> {
    // Visiting variable statements is a bit of a pain because
    // we need to recursively visit destructured expressions.
    //
    // For example, suppose that we want to box `y` in
    //
    //     let x = 10, { y, z } = expr, w = 20;
    //
    // then we need to add an extra statement and split everything up
    //
    //     let x = 10;
    //     let { tmp, z } = expr;
    //     let y = { value: tmp };
    //     let w = 20;
    //

    let statements: ts.Statement[] = [];
    let fixups: ts.Statement[] = [];
    let declarations: ts.VariableDeclaration[] = [];

    function flushDeclarations() {
      if (declarations.length === 0) {
        return;
      }

      statements.push(
        ts.updateVariableStatement(
          statement,
          statement.modifiers,
          ts.updateVariableDeclarationList(
            statement.declarationList,
            declarations)));
    }

    let visitBinding = (name: ts.BindingName): ts.BindingName => {

      if (ts.isIdentifier(name)) {
        let id = this.scope.getId(name.text);
        let init = this.visitDef(name, id);
        let rewrite = this.visitAssignment(name, id);
        if (rewrite) {
          let temp = this.createTempVariable();
          fixups.push(
            ts.createVariableStatement(
              [],
              [
                ts.createVariableDeclaration(
                  name,
                  undefined,
                  init)
              ]),
            ts.createStatement(
              rewrite(
                ts.createAssignment(name, temp))));
          return temp;
        } else {
          return name;
        }
      } else if (ts.isArrayBindingPattern(name)) {
        let newElements: ts.ArrayBindingElement[] = [];
        for (let elem of name.elements) {
          if (ts.isOmittedExpression(elem)) {
            newElements.push(elem);
          } else {
            newElements.push(
              ts.updateBindingElement(
                elem,
                elem.dotDotDotToken,
                elem.propertyName,
                visitBinding(elem.name),
                elem.initializer));
          }
          return ts.updateArrayBindingPattern(
            name,
            newElements);
        }
      } else {
        let newElements: ts.BindingElement[] = [];
        for (let elem of name.elements) {
          newElements.push(
            ts.updateBindingElement(
              elem,
              elem.dotDotDotToken,
              elem.propertyName,
              visitBinding(elem.name),
              elem.initializer));
        }
        return ts.updateObjectBindingPattern(
          name,
          newElements);
      }
    }

    for (let decl of statement.declarationList.declarations) {
      let name = decl.name;
      // Define the declaration's names.
      this.defineVariables(decl.name);
      // Visit the initializer expression.
      let initializer = this.visitExpression(decl.initializer);
      if (ts.isIdentifier(name)) {
        // Simple initializations get special treatment because they
        // don't need a special fix-up statement, even if they are
        // rewritten.
        let id = this.scope.getId(name.text);
        let customInit = this.visitDef(name, id);
        if (initializer) {
          let rewrite = this.visitAssignment(name, id);
          if (rewrite) {
            fixups.push(
              ts.createStatement(
                rewrite(
                  ts.createAssignment(
                    name,
                    initializer))));
            initializer = undefined;
          }
        }
        if (customInit) {
          if (initializer) {
            fixups.push(
              ts.createStatement(
                ts.createAssignment(
                  name,
                  initializer)));
          }
          initializer = customInit;
        }
        declarations.push(
          ts.updateVariableDeclaration(
            decl,
            name,
            decl.type,
            initializer));
      } else {
        // All other patterns are processed by visiting them recursively.
        declarations.push(
          ts.updateVariableDeclaration(
            decl,
            visitBinding(decl.name),
            decl.type,
            initializer));
      }

      // Split the variable statement if we have fix-up statements to emit.
      if (fixups.length > 0) {
        flushDeclarations();
        statements.push(...fixups);
        fixups = [];
      }
    }

    flushDeclarations();

    return statements;
  }

  /**
   * Creates a temporary variable name.
   */
  private createTempVariable(): ts.Identifier {
    let result = ts.createTempVariable(undefined);
    this.scope.define(result.text);
    return result;
  }
}
