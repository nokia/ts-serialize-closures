import * as ts from 'typescript';

/**
 * Creates a node visitor that hoists all function declarations it encounters.
 * @param ctx A transformation context.
 */
export function createFunctionHoistingVisitor(ctx: ts.TransformationContext): ts.Visitor {
  function visit(node: ts.Node): ts.VisitResult<ts.Node> {
    if (ts.isFunctionDeclaration(node)) {
      ctx.hoistFunctionDeclaration(ts.visitEachChild(node, visit, ctx));
      return [];
    } else {
      return ts.visitEachChild(node, visit, ctx);
    }
  }

  return visit;
}

export default function () {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, createFunctionHoistingVisitor(ctx));
  }
}
