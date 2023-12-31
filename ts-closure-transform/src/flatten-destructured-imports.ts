import * as ts from 'typescript';

// This module implements a transformation that flattens destructured import
// statements.
//
// Essentially, what we're doing here is the following transformation:
//
//     import { a, b } from 'c';
//
// -->
//
//     import * as temp from 'c';
//     var a = temp.a;
//     var b = temp.b;
//
// The reason for why we do this is essentially just how the TypeScript
// compiler works: imports and exports are rewritten in a pretty underhanded
// way that breaks the closure transform.
//
// If we didn't do this transform, then we would get situations like the following:
//
//     Source:
//         import { a } from 'c';
//         let f = () => a;
//
//     Closure transform:
//         import { a } from 'c';
//         var temp;
//         let f = (temp = () => a, temp.__closure = () => ({ a: a }), temp);
//
//     Module import/export transform:
//         var _c = require('c');
//         var temp;
//         let f = (temp = () => _c.a, temp.__closure = () => ({ a: _c.a }), temp);
//
// The end result will fail horribly once deserialized because 'f' doesn't actually
// capture 'a' in the final code.
//
// We can't control the module import/export transform, but one thing we can do is
// insert a transform of our own prior to the closure transform. That's where this
// transform comes in.

/**
 * Applies a mapping to all unqualified identifiers in a node.
 * @param node The node to visit (recursively).
 * @param mapping The mapping to apply to all unqualified identifiers.
 * @param ctx A transformation context.
 */
function mapUnqualifiedIdentifiers<T extends ts.Node>(
  node: T,
  mapping: (identifier: ts.Identifier) => ts.Identifier,
  ctx: ts.TransformationContext): T {

  function visit<TNode extends ts.Node>(node: TNode): TNode {
    if (node === undefined) {
      return undefined;
    } else if (ts.isIdentifier(node)) {
      return <TNode><any>mapping(node);
    } else if (ts.isPropertyAccessExpression(node)) {
      return <TNode><any>ts.factory.updatePropertyAccess(
        node,
        visit(node.expression),
        node.name);
    } else if (ts.isPropertyAssignment(node)) {
      return <TNode><any>ts.factory.updatePropertyAssignment(
        node,
        node.name,
        visit(node.initializer));
    } else if (ts.isShorthandPropertyAssignment(node)) {
      return <TNode><any>ts.factory.updateShorthandPropertyAssignment(
        node,
        node.name,
        visit(node.objectAssignmentInitializer));
    } else {
      return ts.visitEachChild(node, visit, ctx);
    }
  }

  return visit(node);
}

/**
 * Creates a visitor that rewrites imports.
 * @param ctx A transformation context.
 */
function createVisitor(ctx: ts.TransformationContext): ts.Visitor {
  function visitTopLevel<T extends ts.Node>(topLevel: T): T {

    // Maintain a set of all imports that have been flattened.
    let modifiedSet: string[] = [];

    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isImportDeclaration(node)) {
        let clause = node.importClause;
        if (clause) {
          // Create a temporary name for the imported module.
          let temp = ts.factory.createUniqueName("_tct_flatten_destructured_imports");
          // Bind each import to a variable.
          let importBindings = [];

          if (clause.name) {
            // Process the default import statement
            importBindings.push(
              ts.factory.createVariableStatement(
                [],
                [
                  ts.factory.createVariableDeclaration(
                    clause.name,
                    undefined,
                    ts.factory.createPropertyAccess(temp, "default"))
                ]));
            modifiedSet.push(clause.name.text);
          }
          let bindings = clause.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings)) {
            importBindings.push(
              ts.factory.createVariableStatement(
                [],
                [
                  ts.factory.createVariableDeclaration(
                    bindings.name,
                    undefined,
                    temp)
                ]));
            modifiedSet.push(bindings.name.text);
          }
          if (bindings && ts.isNamedImports(bindings)) {
            // Named imports. That's exactly what we're looking for.
            for (let specifier of bindings.elements) {
              importBindings.push(
                ts.factory.createVariableStatement(
                  [],
                  [
                    ts.factory.createVariableDeclaration(
                      specifier.name,
                      undefined,
                      ts.factory.createPropertyAccessExpression(temp, specifier.propertyName || specifier.name))
                  ]));
              modifiedSet.push(specifier.name.text);
            }
          }
          return [
            ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              ts.factory.updateImportClause(
                clause,
                clause.isTypeOnly,
                clause.name,
                ts.factory.createNamespaceImport(temp)),
              node.moduleSpecifier, node.attributes),
            ...importBindings
          ];
        }
        return ts.visitEachChild(node, visit, ctx);
      } else {
        return ts.visitEachChild(node, visit, ctx);
      }
    }

    let visited = <T>visit(topLevel);
    return <T>mapUnqualifiedIdentifiers(
      visited,
      ident => {
        if (modifiedSet.indexOf(ident.text) >= 0) {
          // Replace the original identifier with a synthetic
          // identifier to keep the TypeScript compiler from
          // applying its import/export voodoo where it shouldn't.
          return ts.factory.createIdentifier(ident.text);
        } else {
          return ident;
        }
      },
      ctx);
  }

  return visitTopLevel;
}

export default function () {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.Node> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, createVisitor(ctx));
  }
}
