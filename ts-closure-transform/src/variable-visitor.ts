import * as ts from 'typescript';
import { simplifyExpression, noAssignmentTokenMapping } from './simplify';

/**
 * Gets a node's emit flags.
 * @param node A node to query.
 */
function getEmitFlags(node: ts.Node): ts.EmitFlags | undefined {
  // NOTE: this is a hack that inspects the TypeScript compiler's internals.
  // The reason we're resorting to this is that TypeScript does not export
  // its version of `getEmitFlags`---it only exports `setEmitFlags`.
  let castNode = node as ts.Node & { emitNode?: { flags: ts.EmitFlags } };
  let emitNode = castNode.emitNode;
  return emitNode && emitNode.flags;
}

/**
 * Tells if an identifier is implicitly exported, i.e., if it should
 * really be treated as an `exports.Id` expression as opposed to just `Id`.
 * @param node An identifier to query.
 */
function isExportedName(node: ts.Identifier): boolean {
  let flags = getEmitFlags(node);
  if (flags) {
    return (flags & ts.EmitFlags.ExportName) === ts.EmitFlags.ExportName;
  } else {
    return false;
  }
}

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
   * A set of variable IDs that have not been explicitly defined
   * in a variable numbering scope yet. This set is shared by
   * all variable numbering scopes and can be indexed by variable
   * names.
   */
  private readonly pendingVariables: { [name: string]: VariableId };

  /**
   * This scope's parent scope.
   */
  readonly parent: VariableNumberingScope | undefined;

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
   * Defines in this scope all variables specified by a binding name.
   * @param name A binding name that lists variables to define.
   */
  defineVariables(name: ts.BindingName) {
    if (name === undefined) {

    } else if (ts.isIdentifier(name)) {
      if (!isExportedName(name)) {
        this.define(name);
      }
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
      return ts.factory.createBlock([]);
    } else if (Array.isArray(result)) {
      if (result.length == 1) {
        return <ts.Statement>result[0];
      } else {
        return ts.factory.createBlock(<ts.Statement[]>result);
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
        && node.text !== "arguments"
        && !isExportedName(node)) {
        return this.visitUse(node, this.scope.getId(node));
      } else {
        return node;
      }

    } else if (ts.isTypeNode(node)) {
      // Don't visit type nodes.
      return node;

    } else if (ts.isPropertyAccessExpression(node)) {
      return ts.factory.updatePropertyAccessExpression(
        node,
        this.visitExpression(node.expression),
        node.name);

    } else if (ts.isQualifiedName(node)) {
      return ts.factory.updateQualifiedName(
        node,
        <ts.EntityName>this.visit(node.left),
        node.right);

    } else if (ts.isPropertyAssignment(node)) {
      return ts.factory.updatePropertyAssignment(
        node,
        node.name,
        this.visitExpression(node.initializer));

    } else if (ts.isShorthandPropertyAssignment(node)) {
      return ts.factory.updateShorthandPropertyAssignment(
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
    } else if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      return this.visitForInOrOfStatement(node);
    } else if (ts.isTryStatement(node)) {
      return this.visitTryStatement(node);
    }
    // Things that introduce scopes.
    else if (ts.isArrowFunction(node)) {
      let body = this.visitFunctionBody(node.parameters, node.body);
      return ts.factory.updateArrowFunction(
        node,
        node.modifiers,
        node.typeParameters,
        node.parameters,
        node.type,
        node.equalsGreaterThanToken,
        body);

    } else if (ts.isFunctionExpression(node)) {
      let body = this.visitFunctionBody(node.parameters, node.body, node.name);
      return ts.factory.updateFunctionExpression(
        node,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        node.type,
        body);

    } else if (ts.isGetAccessor(node)) {
      return ts.factory.updateGetAccessorDeclaration(
        node,
        node.modifiers,
        node.name,
        node.parameters,
        node.type,
        this.visitFunctionBody(node.parameters, node.body));

    } else if (ts.isSetAccessor(node)) {
      return ts.factory.updateSetAccessorDeclaration(
        node,
        node.modifiers,
        node.name,
        node.parameters,
        this.visitFunctionBody(node.parameters, node.body));

    } else if (ts.isMethodDeclaration(node)) {
      return ts.factory.updateMethodDeclaration(
        node,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        node.type,
        this.visitFunctionBody(node.parameters, node.body));

    } else if (ts.isFunctionDeclaration(node)) {
      return this.visitFunctionDeclaration(node);

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
    return ts.factory.updateBlock(
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
    if (ts.isIdentifier(lhs) && !isExportedName(lhs)) {
      // Syntax we'd like to handle: identifier [+,-,*,/,...]= rhs;
      let id = this.scope.getId(lhs);

      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        let visited = ts.factory.updateBinaryExpression(
          node,
          lhs,
          node.operatorToken,
          this.visitExpression(node.right),
          );
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
            ts.factory.updateBinaryExpression(
              node,
              lhs,
              ts.factory.createToken(ts.SyntaxKind.EqualsToken),
              ts.factory.createBinaryExpression(
                this.visitUse(lhs, id),
                node.operatorToken,
                this.visitExpression(node.right)),
              ));
        } else {
          return ts.factory.updateBinaryExpression(
            node,
            lhs,
            node.operatorToken,
            this.visitExpression(node.right),
            );
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
    if (ts.isIdentifier(expression.operand) && !isExportedName(expression.operand)) {
      let id = this.scope.getId(expression.operand);
      let rewrite = this.visitAssignment(expression.operand, id);
      if (rewrite) {
        // Rewrite pre-increment and pre-decrement updates by desugaring them and
        // then rewriting the desugared version.
        let use = this.visitUse(expression.operand, id);
        let value = expression.operator === ts.SyntaxKind.PlusPlusToken
          ? ts.factory.createAdd(use, ts.createLiteral(1))
          : ts.factory.createSubtract(use, ts.createLiteral(1));

        return simplifyExpression(
          rewrite(
            ts.factory.createAssignment(
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
    if (ts.isIdentifier(expression.operand) && !isExportedName(expression.operand)) {
      let id = this.scope.getId(expression.operand);
      let rewrite = this.visitAssignment(expression.operand, id);
      if (rewrite) {
        // Rewrite post-increment and post-decrement updates by desugaring them and
        // then rewriting the desugared version.
        let secondUse = this.visitUse(expression.operand, id);
        let value = expression.operator === ts.SyntaxKind.PlusPlusToken
          ? ts.factory.createAdd(secondUse, ts.factory.createLiteral(1))
          : ts.factory.createSubtract(secondUse, ts.createLiteral(1));

        if (expression.parent &&
          (ts.isExpressionStatement(expression.parent)
            || ts.isForStatement(expression.parent))) {
          // If the postfix update's parent is an expression statement or a
          // 'for' statement then we don't need an extra variable.
          return simplifyExpression(
            rewrite(
              ts.factory.createAssignment(
                expression.operand,
                value)));
        } else {
          let temp = this.createTemporary();
          this.ctx.hoistVariableDeclaration(temp);

          let firstUse = this.visitUse(expression.operand, id);

          return ts.factory.createCommaListExpression(
            [
              ts.factory.createAssignment(
                temp,
                firstUse),
              simplifyExpression(
                rewrite(
                  ts.factory.createAssignment(
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
   * Defines all variables in a binding name.
   * @param name A binding name.
   * @param scope The scope to define the variables in.
   */
  private defineVariables(name: ts.BindingName) {
    // This is a little off for 'let' bindings, but we'll just
    // assume that those have all been lowered to 'var' already.
    this.scope.functionScope.defineVariables(name);
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
        ts.factory.updateVariableStatement(
          statement,
          statement.modifiers,
          ts.factory.updateVariableDeclarationList(
            statement.declarationList,
            declarations)));
      declarations = [];
    }

    let visitBinding = (name: ts.BindingName): ts.BindingName => {

      if (ts.isIdentifier(name)) {
        if (isExportedName(name)) {
          return name;
        }

        let id = this.scope.getId(name);
        let init = this.visitDef(name, id);
        let rewrite = this.visitAssignment(name, id);
        if (rewrite) {
          let temp = this.createTemporary();
          fixups.push(
            ts.factory.createVariableStatement(
              [],
              [
                ts.factory.createVariableDeclaration(
                  name,
                  undefined,
                  undefined,
                  init)
              ]),
            ts.createStatement(
              rewrite(
                ts.factory.createAssignment(name, temp))));
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
              ts.factory.updateBindingElement(
                elem,
                elem.dotDotDotToken,
                elem.propertyName,
                visitBinding(elem.name),
                elem.initializer));
          }
          return ts.factory.updateArrayBindingPattern(
            name,
            newElements);
        }
      } else {
        let newElements: ts.BindingElement[] = [];
        for (let elem of name.elements) {
          newElements.push(
            ts.factory.updateBindingElement(
              elem,
              elem.dotDotDotToken,
              elem.propertyName,
              visitBinding(elem.name),
              elem.initializer));
        }
        return ts.factory.updateObjectBindingPattern(
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
        if (!isExportedName(name)) {
          // Simple initializations get special treatment because they
          // don't need a special fix-up statement, even if they are
          // rewritten.
          let id = this.scope.getId(name);
          let customInit = this.visitDef(name, id);
          if (initializer) {
            let rewrite = this.visitAssignment(name, id);
            if (rewrite) {
              fixups.push(
                ts.factory.createStatement(
                  rewrite(
                    ts.factory.createAssignment(
                      name,
                      initializer))));
              initializer = undefined;
            }
          }
          if (customInit) {
            if (initializer) {
              fixups.push(
                ts.factory.createStatement(
                  ts.factory.createAssignment(
                    name,
                    initializer)));
            }
            initializer = customInit;
          }
        }
        declarations.push(
          ts.factory.updateVariableDeclaration(
            decl,
            name,
            decl.exclamationToken,
            decl.type,
            initializer));
      } else {
        // All other patterns are processed by visiting them recursively.
        declarations.push(
          ts.factory.updateVariableDeclaration(
            decl,
            visitBinding(decl.name),
            decl.exclamationToken,
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
      let initializer = this.visitStatement(ts.factory.createVariableStatement([], statement.initializer));

      // Also visit the condition, incrementor and body.
      let condition = this.visitExpression(statement.condition);
      let incrementor = this.visitExpression(statement.incrementor);
      let body = this.visitStatement(statement.statement);

      if (ts.isVariableStatement(initializer)) {
        // If the initializer has been rewritten as a variable declaration, then
        // we can create a simple 'for' loop.
        result = ts.factory.updateForStatement(statement, initializer.declarationList, condition, incrementor, body);
      } else {
        // Otherwise, we'll factor out the initializer.
        result = ts.factory.createBlock([
          initializer,
          ts.factory.updateForStatement(statement, undefined, condition, incrementor, body)
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
   * Visits a 'try' statement.
   * @param statement The statement to visit.
   */
  private visitTryStatement(statement: ts.TryStatement): ts.VisitResult<ts.Statement> {
    let tryBlock = this.visitBlock(statement.tryBlock);
    let catchClause;
    if (statement.catchClause) {
      // Catch clauses may introduce a new, locally-scoped variable.
      let oldScope = this.scope;
      this.scope = new VariableNumberingScope(false, oldScope);
      if (statement.catchClause.variableDeclaration) {
        // FIXME: allow this variable to be rewritten.
        this.defineVariables(statement.catchClause.variableDeclaration.name);
      }
      catchClause = ts.factory.updateCatchClause(
        statement.catchClause,
        statement.catchClause.variableDeclaration,
        this.visitBlock(statement.catchClause.block));
      this.scope = oldScope;
    } else {
      catchClause = statement.catchClause;
    }
    let finallyBlock = statement.finallyBlock
      ? this.visitBlock(statement.finallyBlock)
      : statement.finallyBlock;
    return ts.factory.updateTryStatement(statement, tryBlock, catchClause, finallyBlock);
  }

  /**
   * Visits a 'for...in/of' statement.
   * @param statement The statement to visit.
   */
  private visitForInOrOfStatement(statement: ts.ForInOrOfStatement): ts.VisitResult<ts.Statement> {
    // 'for' statements may introduce a new, locally-scoped variable.
    let oldScope = this.scope;
    this.scope = new VariableNumberingScope(false, oldScope);
    let initializer = statement.initializer;
    if (ts.isVariableDeclarationList(initializer)) {
      // FIXME: allow declarations to be rewritten here.
      for (let element of initializer.declarations) {
        this.defineVariables(element.name);
      }
    } else {
      initializer = this.visitExpression(initializer);
    }
    let expr = this.visitExpression(statement.expression);
    let body = this.visitStatement(statement.statement);
    this.scope = oldScope;

    if (ts.isForInStatement(statement)) {
      return ts.factory.updateForInStatement(statement, initializer, expr, body);
    } else {
      return ts.factory.updateForOfStatement(statement, statement.awaitModifier, initializer, expr, body);
    }
  }

  /**
   * Visits a function body.
   * @param parameters The function's list of parameters.
   * @param body The function's body.
   * @param body The function's name, if any.
   */
  private visitFunctionBody(
    parameters: ts.NodeArray<ts.ParameterDeclaration>,
    body: ts.Block | ts.Expression,
    name?: ts.Identifier) {

    let oldScope = this.scope;
    this.scope = new VariableNumberingScope(true, oldScope);

    if (name !== undefined) {
      this.defineVariables(name);
    }

    for (let param of parameters) {
      this.defineVariables(param.name);
    }

    let result;
    if (ts.isBlock(body)) {
      result = this.visitBlock(body);
    } else {
      result = this.visitExpression(body);
    }

    this.scope = oldScope;
    return result;
  }

  /**
   * Visits a function declaration node.
   * @param node The function declaration node to visit.
   */
  private visitFunctionDeclaration(node: ts.FunctionDeclaration): ts.VisitResult<ts.Statement> {
    // We need to be careful here because function declarations
    // are actually variable definitions and assignments. If
    // the variable visitor decides to rewrite a function
    // declaration, then we need to rewrite it as an expression.
    let defInitializer: ts.Expression = undefined;
    let rewriteAssignment: ((assignment: ts.BinaryExpression) => ts.Expression) = undefined;
    if (node.name) {
      this.defineVariables(node.name);
      let id = this.scope.getId(node.name);
      defInitializer = this.visitDef(node.name, id);
      rewriteAssignment = this.visitAssignment(node.name, id);
    }

    let body = this.visitFunctionBody(node.parameters, node.body);

    if (defInitializer || rewriteAssignment) {
      let funExpr = ts.factory.createFunctionExpression(
        // @ts-ignore
        node.modifiers,
        node.asteriskToken,
        undefined,
        node.typeParameters,
        node.parameters,
        node.type,
        body);

      let funAssignment = ts.factory.createAssignment(node.name, funExpr);

      return [
        ts.factory.createVariableStatement(
          [],
          [ts.factory.createVariableDeclaration(node.name, undefined, undefined,defInitializer)]),
        ts.createStatement(rewriteAssignment ? rewriteAssignment(funAssignment) : funAssignment)
      ];

    } else {
      return ts.factory.updateFunctionDeclaration(
        node,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        node.type,
        body);
    }
  }

  /**
   * Creates a temporary variable name.
   */
  protected createTemporary(): ts.Identifier {
    let result = ts.factory.createUniqueName("_tct_variable_visitor");
    this.scope.define(result);
    return result;
  }
}
