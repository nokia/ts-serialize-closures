import * as ts from 'typescript';

/**
 * Simplifies a particular node.
 * @param node The node to simplify.
 */
export function simplify(node: ts.Node): ts.Node {
  if (ts.isBinaryExpression(node)) {
    if (ts.isBinaryExpression(node.right)
      && node.right.operatorToken.kind in assignmentTokenMapping
      && areEqual(node.left, node.right.left)) {

      // a = a <op> b
      // -->
      // a <op>= b

      return simplify(
        ts.factory.updateBinaryExpression(
          node,
          node.left,
          ts.factory.createToken(assignmentTokenMapping[node.right.operatorToken.kind]),
          node.right.right,
          ));
    } else if (ts.isLiteralExpression(node.right)
      && node.right.text === '1') {

      if (node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) {
        // a += 1
        // -->
        // ++a
        return ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.PlusPlusToken, node.left);
      } else if (node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken) {
        // a -= 1
        // -->
        // --a
        return ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.MinusMinusToken, node.left);
      }
    }
  }
  return node;
}

/**
 * Simplifies a particular expression.
 * @param expr The expression to simplify.
 */
export function simplifyExpression(expr: ts.Expression): ts.Expression {
  return <ts.Expression>simplify(expr);
}

/**
 * Simplifies a particular statement.
 * @param stmt The statement to simplify.
 */
export function simplifyStatement(stmt: ts.Statement): ts.Statement {
  return <ts.Statement>simplify(stmt);
}

/**
 * Tests if two nodes are definitely structurally equal.
 * May produce false negatives, but will never produce false positives.
 * @param left The left-hand side of the comparison.
 * @param right The right-hand side of the comparison.
 */
export function areEqual(left: ts.Node, right: ts.Node): boolean {
  if (left === right) {
    return true;
  } else if (ts.isIdentifier(left) && ts.isIdentifier(right)) {
    return left.text !== '' && left.text === right.text;
  } else if (ts.isPropertyAccessExpression(left) && ts.isPropertyAccessExpression(right)) {
    return areEqual(left.name, right.name)
      && areEqual(left.expression, right.expression);
  } else {
    return false;
  }
}

export const noAssignmentTokenMapping = {
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

const assignmentTokenMapping = (() => {
  let results: any = {};
  for (let key in noAssignmentTokenMapping) {
    results[noAssignmentTokenMapping[key]] = parseInt(key);
  }
  return results;
})();
