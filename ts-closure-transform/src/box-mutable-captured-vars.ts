import * as ts from 'typescript';
import { VariableVisitor, VariableId, VariableNumberingScope, VariableNumberingStore } from './variable-visitor';

// This is a compiler pass that takes mutable captured variables and wraps
// them in 'box' objects.
//
// Here's a quick example:
//
//     function counter() {
//         let ctr = 0;
//         return {
//             'get': (() => ctr),
//             'increment': (() => { ctr++; })
//         };
//     }
//
// will get transformed to
//
//     function counter() {
//         let ctr = { value: undefined };
//         ctr.value = 0;
//         return {
//             'get': (() => ctr.value),
//             'increment': (() => { ctr.value++; })
//         };
//     }
//
// By performing this transformation, functions capturing the mutable variable will
// share an object reference to the shared value instead of the value itself.
// We can't directly serialize shared values without un-sharing them, but we can
// serialize object references to shared values.

/**
 * A variable visitor that tracks down mutable shared variables.
 */
export class MutableSharedVariableFinder extends VariableVisitor {
  /**
   * A mapping of variable IDs to the number of times those variables
   * are updated.
   */
  private readonly updateCounts: { [id: number]: number };

  /**
   * A mapping of variable IDs to the scopes that define those IDs.
   */
  private readonly defScopes: { [id: number]: VariableNumberingScope };

  /**
   * A mapping of variable IDs to the scopes wherein they are used.
   * This mapping only contains IDs for variables that are still pending,
   * i.e., they have not been assigned a definition scope yet.
   */
  private readonly pendingAppearanceScopes: { [id: number]: VariableNumberingScope[] };

  /**
   * A list of all shared variable IDs.
   */
  private readonly sharedVars: VariableId[];

  /**
   * Creates a mutable shared variable finder.
   * @param ctx A transformation context.
   */
  constructor(ctx: ts.TransformationContext) {
    super(ctx);
    this.updateCounts = {};
    this.defScopes = {};
    this.pendingAppearanceScopes = {};
    this.sharedVars = [];
  }

  /**
   * Gets a list of all shared variables detected by this variable visitor.
   */
  get sharedVariables(): ReadonlyArray<VariableId> {
    return this.sharedVars;
  }

  /**
   * Gets a list of all shared mutable variables detected by this variable visitor.
   */
  get mutableSharedVariables(): ReadonlyArray<VariableId> {
    let results = [];
    for (let id of this.sharedVars) {
      if (this.updateCounts[id] > 1) {
        results.push(id);
      }
    }
    return results;
  }

  protected visitUse(node: ts.Identifier, id: VariableId): ts.Expression {
    this.noteAppearance(id);
    
    return node;
  }
  
  protected visitDef(node: ts.Identifier, id: VariableId): ts.Expression {
    this.defScopes[id] = this.scope.functionScope;

    if (id in this.pendingAppearanceScopes) {
      // Handle pending appearances.
      for (let scope of this.pendingAppearanceScopes[id]) {
        this.noteAppearanceIn(id, scope);
      }
      delete this.pendingAppearanceScopes[id];
    }

    return undefined;
  }

  protected visitAssignment(name: ts.Identifier, id: VariableId):
    (assignment: ts.BinaryExpression) => ts.Expression {

    this.noteAppearance(id);

    if (!this.updateCounts[id]) {
      this.updateCounts[id] = 0;
    }
    this.updateCounts[id]++;

    return undefined;
  }

  private noteAppearance(id: VariableId) {
    if (id in this.defScopes) {
      this.noteAppearanceIn(id, this.scope);
    } else {
      if (!(id in this.pendingAppearanceScopes)) {
        this.pendingAppearanceScopes[id] = [];
      }
      this.pendingAppearanceScopes[id].push(this.scope.functionScope);
    }
  }

  private noteAppearanceIn(id: VariableId, scope: VariableNumberingScope) {
    if (this.defScopes[id] !== scope.functionScope) {
      if (this.sharedVars.indexOf(id) < 0) {
        this.sharedVars.push(id);
      }
    }
  }
}

/**
 * A variable visitor that boxes variables.
 */
class VariableBoxingVisitor extends VariableVisitor {
  /**
   * A list of all variables to box.
   */
  readonly variablesToBox: ReadonlyArray<VariableId>;

  /**
   * Creates a variable boxing visitor.
   * @param ctx A transformation context.
   * @param store The variable numbering store to use.
   * @param variablesToBox The variables to box, numbered by `store`.
   */
  constructor(
    ctx: ts.TransformationContext,
    store: VariableNumberingStore,
    variablesToBox: ReadonlyArray<VariableId>) {

    super(ctx, store);
    this.variablesToBox = variablesToBox;
  }

  protected visitUse(node: ts.Identifier, id: VariableId): ts.Expression {
    if (this.variablesToBox.indexOf(id) >= 0) {
      return ts.factory.createPropertyAccessExpression(node, "value");
    } else {
      return node;
    }
  }

  protected visitDef(node: ts.Identifier, id: VariableId): ts.Expression {
    if (this.variablesToBox.indexOf(id) >= 0) {
      return ts.factory.createObjectLiteralExpression([ts.factory.createPropertyAssignment("value", ts.factory.createIdentifier("undefined"))]);
    } else {
      return undefined;
    }
  }

  protected visitAssignment(name: ts.Identifier, id: VariableId): (assignment: ts.BinaryExpression) => ts.Expression {
    if (this.variablesToBox.indexOf(id) >= 0) {
      return assignment => ts.factory.updateBinaryExpression(
        assignment,
        ts.factory.createPropertyAccessExpression(name, "value"),
        assignment.operatorToken,
        assignment.right,
        );
    } else {
      return undefined;
    }
  }
}

function createVisitor(ctx: ts.TransformationContext): ts.Visitor {
  return node => {
    let analyzer = new MutableSharedVariableFinder(ctx);
    node = <ts.Node>analyzer.visit(node);
    let rewriter = new VariableBoxingVisitor(
      ctx,
      analyzer.store,
      analyzer.mutableSharedVariables);
    return rewriter.visit(node);
  };
}

export default function () {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.Node> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, createVisitor(ctx));
  }
}
