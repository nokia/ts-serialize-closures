import * as ts from 'typescript';
import { simplifyExpression, noAssignmentTokenMapping } from './simplify';

/**
 * The type of a unique variable identifier.
 */
export type VariableId = number;

/**
 * A backing store for variable numbering.
 */
export class VariableNumberingStore {
  private readonly numbering: { name: ts.Identifier, id: VariableId }[];
  private counter: number;

  /**
   * Creates an empty variable numbering store.
   */
  constructor() {
    this.numbering = [];
    this.counter = 0;
  }

  /**
   * Sets the variable id of an identifier.
   * @param identifier An identifier.
   * @param id The variable id to assign to `identifier`.
   */
  setId(identifier: ts.Identifier, id: VariableId): void {
    for (let record of this.numbering) {
      if (record.name === identifier) {
        record.id = id;
        return;
      }
    }
    this.numbering.push({ name: identifier, id });
  }

  /**
   * Gets the variable id for a particular identifier.
   * If the identifier has not been associated with a variable
   * id yet, then a new one is created.
   * @param identifier The identifier to find a variable id for.
   */
  getOrCreateId(identifier: ts.Identifier): VariableId {
    for (let { name, id } of this.numbering) {
      if (name === identifier) {
        return id;
      }
    }
    let id = this.counter++;
    this.numbering.push({ name: identifier, id });
    return id;
  }
}

/**
 * A scope data structure that assigns a unique id to each variable.
 */
export class VariableNumberingScope {
  /**
   * All local variables defined in this scope.
   */
  private readonly localVariables: { [name: string]: VariableId };

  /**
   * This scope's parent scope.
   */
  private readonly parent: VariableNumberingScope | undefined;

  /**
   * A set of variable IDs that have not been explicitly defined
   * in a variable numbering scope yet. This set is shared by
   * all variable numbering scopes and can be indexed by variable
   * names.
   */
  private readonly pendingVariables: { [name: string]: VariableId };

  /**
   * The variable numbering store for this scope.
   */
  readonly store: VariableNumberingStore;

  /**
   * Tells if this scope is a function scope.
   */
  readonly isFunctionScope: boolean;

  /**
   * Creates a variable numbering scope.
   * @param isFunctionScope Tells if the scope is a function scope.
   * @param parentOrStore A parent scope or a variable numbering store.
   */
  constructor(isFunctionScope: boolean, parentOrStore?: VariableNumberingScope | VariableNumberingStore) {
    this.isFunctionScope = isFunctionScope;
    this.localVariables = {};
    if (!parentOrStore) {
      this.parent = undefined;
      this.pendingVariables = {};
      this.store = new VariableNumberingStore();
    } else if (parentOrStore instanceof VariableNumberingScope) {
      this.parent = parentOrStore;
      this.pendingVariables = parentOrStore.pendingVariables;
      this.store = parentOrStore.store;
    } else {
      this.parent = undefined;
      this.pendingVariables = {};
      this.store = parentOrStore;
    }
  }

  /**
   * Defines a variable with a particular name in
   * the current scope.
   * @param name The name of the variable to define.
   */
  define(name: ts.Identifier): VariableId {
    // If the variable is pending, then we want to reuse
    // the pending ID.
    let newId: VariableId;
    if (name.text in this.pendingVariables) {
      newId = this.pendingVariables[name.text];
      delete this.pendingVariables[name.text];
      this.store.setId(name, newId);
    } else {
      newId = this.store.getOrCreateId(name);
    }

    if (name.text !== "") {
      this.localVariables[name.text] = newId;
    }
    return newId;
  }

  /**
   * Gets the identifier for a variable with a
   * particular name in the current scope.
   * @param name The name of the variable.
   */
  getId(name: ts.Identifier): VariableId {
    let text = name.text;
    if (text in this.localVariables) {
      // If the name is defined in the local variables,
      // then just grab its id. Also, don't forget to
      // update the variable numbering store.
      let id = this.localVariables[text];
      this.store.setId(name, id);
      return id;
    } else if (text in this.pendingVariables) {
      // If the name is defined in the pending variables,
      // then we'll essentially do the same thing.
      let id = this.pendingVariables[text];
      this.store.setId(name, id);
      return id;
    } else if (this.parent) {
      // If the scope has a parent and the name is not defined
      // as a local variable, then defer to the parent.
      return this.parent.getId(name);
    } else {
      // Otherwise, add the name to the pending list.
      let id = this.store.getOrCreateId(name);
      this.pendingVariables[name.text] = id;
      return id;
    }
  }

  /**
   * Gets the function scope of this scope,
   * which is this scope if it is a function or top-level scope and
   * the enclosing scope's function scope otherwise.
   */
  get functionScope(): VariableNumberingScope {
    if (this.isFunctionScope || !this.parent) {
      return this;
    } else {
      return this.parent.functionScope;
    }
  }
}

/**
 * A base class for visitors that visit variable uses,
 * definitions and assignments.
 */
export abstract class VariableVisitor {
  /**
   * The scope the variable visitor is currently in.
   */
  protected scope: VariableNumberingScope;

  /**
   * The transformation context.
   */
  readonly ctx: ts.TransformationContext;

  /**
   * Creates a variable visitor.
   * @param ctx The visitor's transformation context.
   * @param store An optional variable numbering store.
   */
  constructor(ctx: ts.TransformationContext, store?: VariableNumberingStore) {
    this.ctx = ctx;
    this.scope = new VariableNumberingScope(true, store);
  }

  /**
   * Gets the variable numbering store used by this visitor.
   */
  get store(): VariableNumberingStore {
    return this.scope.store;
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
   * Visits a statement node. If the statement expands into more than
   * one statement or no statements at all, then the result is wrapped
   * in a block.
   * @param node The statement node to visit.
   */
  protected visitStatement(node: ts.Statement): ts.Statement {
    let result = this.visit(node);
    if (result === undefined) {
      return ts.createBlock([]);
    } else if (Array.isArray(result)) {
      if (result.length == 1) {
        return <ts.Statement>result[0];
      } else {
        return ts.createBlock(<ts.Statement[]>result);
      }
    } else {
      return <ts.Statement>result;
    }
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
      if (node.text !== "undefined"
        && node.text !== "null"
        && node.text !== "arguments") {
        return this.visitUse(node, this.scope.getId(node));
      } else {
        return node;
      }

    } else if (ts.isTypeNode(node)) {
      // Don't visit type nodes.
      return node;

    } else if (ts.isPropertyAccessExpression(node)) {
      return ts.updatePropertyAccess(
        node,
        this.visitExpression(node.expression),
        node.name);

    } else if (ts.isQualifiedName(node)) {
      return ts.updateQualifiedName(
        node,
        <ts.EntityName>this.visit(node.left),
        node.right);

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
    } else if (ts.isForStatement(node)) {
      return this.visitForStatement(node);
    }
    // Things that introduce scopes.
    else if (ts.isArrowFunction(node)) {

      let oldScope = this.scope;
      this.scope = new VariableNumberingScope(true, oldScope);

      for (let param of node.parameters) {
        this.defineVariables(param.name);
      }

      let body = node.body;
      if (ts.isBlock(body)) {
        body = this.visitBlock(body);
      } else {
        body = this.visitExpression(body);
      }

      this.scope = oldScope;
      return ts.updateArrowFunction(
        node,
        node.modifiers,
        node.typeParameters,
        node.parameters,
        node.type,
        node.equalsGreaterThanToken,
        body);

    } else if (ts.isFunctionExpression(node)) {

      let oldScope = this.scope;
      this.scope = new VariableNumberingScope(true, oldScope);

      this.defineVariables(node.name);

      for (let param of node.parameters) {
        this.defineVariables(param.name);
      }

      let body = this.visitBlock(node.body);

      this.scope = oldScope;
      return ts.updateFunctionExpression(
        node,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        node.type,
        body);

    } else if (ts.isFunctionDeclaration(node)) {

      let oldScope = this.scope;
      this.scope = new VariableNumberingScope(true, oldScope);

      this.defineVariables(node.name);

      for (let param of node.parameters) {
        this.defineVariables(param.name);
      }

      let body = this.visitBlock(node.body);

      this.scope = oldScope;
      return ts.updateFunctionDeclaration(
        node,
        node.decorators,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        node.type,
        body);

    } else {
      let oldScope = this.scope;
      this.scope = new VariableNumberingScope(false, oldScope);
      let result = this.visitChildren(node);
      this.scope = oldScope;
      return result;
    }
  }

  private visitChildren<T extends ts.Node>(node: T): T {
    return ts.visitEachChild(node, n => this.visit(n), this.ctx);
  }

  private visitBlock(block: ts.Block): ts.Block {
    return ts.updateBlock(
      block,
      ts.visitLexicalEnvironment(
        block.statements,
        n => this.visit(n),
        this.ctx));
  }

  /**
   * Visits a binary expression.
   * @param node The expression to visit.
   */
  private visitBinaryExpression(node: ts.BinaryExpression): ts.Expression {
    let lhs = node.left;
    if (ts.isIdentifier(lhs)) {
      // Syntax we'd like to handle: identifier [+,-,*,/,...]= rhs;
      let id = this.scope.getId(lhs);

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
      } else if (node.operatorToken.kind in noAssignmentTokenMapping) {
        let rewrite = this.visitAssignment(lhs, id);
        if (rewrite) {
          return rewrite(
            ts.updateBinary(
              node,
              lhs,
              ts.createBinary(
                this.visitUse(lhs, id),
                noAssignmentTokenMapping[node.operatorToken.kind],
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

  /**
   * Visits a pre-increment or pre-decrement expression.
   * @param expression The expression to visit.
   */
  private visitPreUpdateExpression(expression: ts.PrefixUnaryExpression): ts.Expression {
    if (ts.isIdentifier(expression.operand)) {
      let id = this.scope.getId(expression.operand);
      let rewrite = this.visitAssignment(expression.operand, id);
      if (rewrite) {
        // Rewrite pre-increment and pre-decrement updates by desugaring them and
        // then rewriting the desugared version.
        let use = this.visitUse(expression.operand, id);
        let value = expression.operator === ts.SyntaxKind.PlusPlusToken
          ? ts.createAdd(use, ts.createLiteral(1))
          : ts.createSubtract(use, ts.createLiteral(1));

        return simplifyExpression(
          rewrite(
            ts.createAssignment(
              expression.operand,
              value)));
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
      let id = this.scope.getId(expression.operand);
      let rewrite = this.visitAssignment(expression.operand, id);
      if (rewrite) {
        // Rewrite post-increment and post-decrement updates by desugaring them and
        // then rewriting the desugared version.
        let secondUse = this.visitUse(expression.operand, id);
        let value = expression.operator === ts.SyntaxKind.PlusPlusToken
          ? ts.createAdd(secondUse, ts.createLiteral(1))
          : ts.createSubtract(secondUse, ts.createLiteral(1));

        if (ts.isExpressionStatement(expression.parent)
          || ts.isForStatement(expression.parent)) {
          // If the postfix update's parent is an expression statement or a
          // 'for' statement then we don't need an extra variable.
          return simplifyExpression(
            rewrite(
              ts.createAssignment(
                expression.operand,
                value)));
        } else {
          let temp = this.createTempVariable();
          this.ctx.hoistVariableDeclaration(temp);

          let firstUse = this.visitUse(expression.operand, id);

          return ts.createCommaList(
            [
              ts.createAssignment(
                temp,
                firstUse),
              simplifyExpression(
                rewrite(
                  ts.createAssignment(
                    expression.operand,
                    value))),
              temp
            ]);
        }
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
    if (name === undefined) {

    } else if (ts.isIdentifier(name)) {
      this.scope.define(name);
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
      declarations = [];
    }

    let visitBinding = (name: ts.BindingName): ts.BindingName => {

      if (ts.isIdentifier(name)) {
        let id = this.scope.getId(name);
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
        let id = this.scope.getId(name);
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
   * Visits a 'for' statement.
   * @param statement The statement to visit.
   */
  private visitForStatement(statement: ts.ForStatement): ts.VisitResult<ts.Statement> {
    // Rewriting variables in 'for' statements is actually pretty hard
    // because definitions, uses and assignments may be rewritten in
    // such a way that a 'for' statement is no longer applicable.
    //
    // For example, consider this 'for' loop:
    //
    //     for (let i = f(); i < 10; i++) {
    //         g();
    //     }
    //
    // If `var i = f()` is rewritten as anything other than a single
    // variable declaration list, then the logic we want to set up
    // can no longer be expressed as a simple 'for' loop. Fortunately,
    // we can factor out the initialization part:
    //
    //     {
    //         let i = f();
    //         for (; i < 10; i++) {
    //             g();
    //         }
    //     }
    //

    // 'for' statements introduce a new scope, so let's handle that right away.
    let oldScope = this.scope;
    this.scope = new VariableNumberingScope(false, oldScope);
    let result;
    if (statement.initializer && ts.isVariableDeclarationList(statement.initializer)) {
      // If the 'for' has a variable declaration list as an initializer, then turn
      // the initializer into a variable declaration statement.
      let initializer = this.visitStatement(ts.createVariableStatement([], statement.initializer));

      // Also visit the condition, incrementor and body.
      let condition = this.visitExpression(statement.condition);
      let incrementor = this.visitExpression(statement.incrementor);
      let body = this.visitStatement(statement.statement);

      if (ts.isVariableStatement(initializer)) {
        // If the initializer has been rewritten as a variable declaration, then
        // we can create a simple 'for' loop.
        result = ts.updateFor(statement, initializer.declarationList, condition, incrementor, body);
      } else {
        // Otherwise, we'll factor out the initializer.
        result = ts.createBlock([
          initializer,
          ts.updateFor(statement, undefined, condition, incrementor, body)
        ]);
      }
    } else {
      result = this.visitChildren(statement);
    }
    // Restore the enclosing scope and return.
    this.scope = oldScope;
    return result;
  }

  /**
   * Creates a temporary variable name.
   */
  private createTempVariable(): ts.Identifier {
    let result = ts.createTempVariable(undefined);
    this.scope.define(result);
    return result;
  }
}
