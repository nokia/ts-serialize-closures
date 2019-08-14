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
class MutableSharedVariableFinder extends VariableVisitor {
  private readonly updateCounts: { [id: number]: number };
  private readonly defScopes: { [id: number]: VariableNumberingScope };
  private readonly sharedVariables: VariableId[];

  /**
   * Creates a mutable shared variable finder.
   * @param ctx A transformation context.
   */
  constructor(ctx: ts.TransformationContext) {
    super(ctx);
    this.updateCounts = {};
    this.defScopes = {};
    this.sharedVariables = [];
  }

  /**
   * Gets a list of all shared mutable variables detected by this variable visitor.
   */
  get mutableSharedVariables(): ReadonlyArray<VariableId> {
    let results = [];
    for (let id of this.sharedVariables) {
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
    if (id in this.defScopes && this.defScopes[id] !== this.scope.functionScope) {
      if (this.sharedVariables.indexOf(id) < 0) {
        this.sharedVariables.push(id);
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
      return ts.createPropertyAccess(node, "value");
    } else {
      return node;
    }
  }

  protected visitDef(node: ts.Identifier, id: VariableId): ts.Expression {
    if (this.variablesToBox.indexOf(id) >= 0) {
      return ts.createObjectLiteral([ts.createPropertyAssignment("value", ts.createIdentifier("undefined"))]);
    } else {
      return undefined;
    }
  }

  protected visitAssignment(name: ts.Identifier, id: VariableId): (assignment: ts.BinaryExpression) => ts.Expression {
    if (this.variablesToBox.indexOf(id) >= 0) {
      return assignment => ts.updateBinary(
        assignment,
        ts.createPropertyAccess(name, "value"),
        assignment.right,
        assignment.operatorToken);
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
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, createVisitor(ctx));
  }
}
