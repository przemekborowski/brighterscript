import { Token, Identifier } from '../lexer';
import { BrsType, ValueKind, BrsString, FunctionParameter } from '../brsTypes';
import { Block, CommentStatement } from './Statement';
import { SourceNode } from 'source-map';

import { Range } from 'vscode-languageserver';
import util from '../util';
import { TranspileState } from './TranspileState';
import { ParseMode } from './Parser';

/** A BrightScript expression */
export interface Expression {
    /** The starting and ending location of the expression. */
    range: Range;

    transpile(state: TranspileState): Array<SourceNode | string>;
}

export class BinaryExpression implements Expression {
    constructor(
        readonly left: Expression,
        readonly operator: Token,
        readonly right: Expression
    ) {
        this.range = Range.create(this.left.range.start, this.right.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        return [
            new SourceNode(this.left.range.start.line + 1, this.left.range.start.character, state.pathAbsolute, this.left.transpile(state)),
            ' ',
            new SourceNode(this.operator.range.start.line + 1, this.operator.range.start.character, state.pathAbsolute, this.operator.text),
            ' ',
            new SourceNode(this.right.range.start.line + 1, this.right.range.start.character, state.pathAbsolute, this.right.transpile(state))
        ];
    }
}

export class CallExpression implements Expression {
    static MaximumArguments = 32;

    constructor(
        readonly callee: Expression,
        readonly openingParen: Token,
        readonly closingParen: Token,
        readonly args: Expression[],
        readonly namespaceName: NamespacedVariableNameExpression
    ) {
        this.range = Range.create(this.callee.range.start, this.closingParen.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        let result = [];

        //transpile the name
        result.push(...this.callee.transpile(state));

        result.push(
            new SourceNode(this.openingParen.range.start.line + 1, this.openingParen.range.start.character, state.pathAbsolute, '(')
        );
        for (let i = 0; i < this.args.length; i++) {
            //add comma between args
            if (i > 0) {
                result.push(', ');
            }
            let arg = this.args[i];
            result.push(...arg.transpile(state));
        }
        result.push(
            new SourceNode(this.closingParen.range.start.line + 1, this.closingParen.range.start.character, state.pathAbsolute, ')')
        );
        return result;
    }
}

export class FunctionExpression implements Expression {
    constructor(
        readonly parameters: FunctionParameter[],
        readonly returns: ValueKind,
        public body: Block,
        readonly functionType: Token | null,
        public end: Token,
        readonly leftParen: Token,
        readonly rightParen: Token,
        readonly asToken?: Token,
        readonly returnTypeToken?: Token,
        /**
         * If this function is enclosed within another function, this will reference that parent function
         */
        readonly parentFunction?: FunctionExpression
    ) {
    }

    /**
     * The list of function calls that are declared within this function scope. This excludes CallExpressions
     * declared in child functions
     */
    public callExpressions = [] as CallExpression[];

    /**
     * The range of the function, starting at the 'f' in function or 's' in sub (or the open paren if the keyword is missing),
     * and ending with the last n' in 'end function' or 'b' in 'end sub'
     */
    public get range() {
        return Range.create(
            (this.functionType ?? this.leftParen).range.start,
            (this.end ?? this.body ?? this.returnTypeToken ?? this.asToken ?? this.rightParen).range.end
        );
    }

    transpile(state: TranspileState, name?: Identifier) {
        let results = [];
        //'function'|'sub'
        results.push(
            new SourceNode(this.functionType.range.start.line + 1, this.functionType.range.start.character, state.pathAbsolute, this.functionType.text.toLowerCase())
        );
        //functionName?
        if (name) {
            results.push(
                ' ',
                new SourceNode(name.range.start.line + 1, name.range.start.character, state.pathAbsolute, name.text)
            );
        }
        //leftParen
        results.push(
            new SourceNode(this.leftParen.range.start.line + 1, this.leftParen.range.start.character, state.pathAbsolute, '(')
        );
        //parameters
        for (let i = 0; i < this.parameters.length; i++) {
            let param = this.parameters[i];
            //add commas
            if (i > 0) {
                results.push(', ');
            }
            //add parameter
            results.push(param.transpile(state));
        }
        //right paren
        results.push(
            new SourceNode(this.rightParen.range.start.line + 1, this.rightParen.range.start.character, state.pathAbsolute, ')')
        );
        //as [Type]
        if (this.asToken) {
            results.push(
                ' ',
                //as
                new SourceNode(this.asToken.range.start.line + 1, this.asToken.range.start.character, state.pathAbsolute, 'as'),
                ' ',
                //return type
                new SourceNode(this.returnTypeToken.range.start.line + 1, this.returnTypeToken.range.start.character, state.pathAbsolute, this.returnTypeToken.text.toLowerCase())
            );
        }
        state.lineage.unshift(this);
        let body = this.body.transpile(state);
        state.lineage.shift();
        results.push(...body);
        results.push('\n');
        //'end sub'|'end function'
        results.push(
            state.indent(),
            new SourceNode(this.end.range.start.line + 1, this.end.range.start.character, state.pathAbsolute, this.end.text)
        );
        return results;
    }
}

export class NamespacedVariableNameExpression implements Expression {
    constructor(
        //if this is a `DottedGetExpression`, it must be comprised only of `VariableExpression`s
        readonly expression: DottedGetExpression | VariableExpression
    ) {
        this.range = expression.range;
    }
    range: Range;

    transpile(state: TranspileState) {
        return [
            new SourceNode(
                this.range.start.line + 1,
                this.range.start.character,
                state.pathAbsolute,
                this.getName(ParseMode.BrightScript)
            )
        ];
    }

    public getNameParts() {
        let parts = [] as string[];
        if (this.expression instanceof VariableExpression) {
            parts.push(this.expression.name.text);
        } else {
            let expr = this.expression;

            parts.push(expr.name.text);

            while (expr instanceof VariableExpression === false) {
                expr = expr.obj as DottedGetExpression;
                parts.unshift(expr.name.text);
            }
        }
        return parts;
    }

    getName(parseMode: ParseMode) {
        if (parseMode === ParseMode.BrighterScript) {
            return this.getNameParts().join('.');
        } else {
            return this.getNameParts().join('_');
        }
    }
}

export class DottedGetExpression implements Expression {
    constructor(
        readonly obj: Expression,
        readonly name: Identifier,
        readonly dot: Token
    ) {
        this.range = Range.create(this.obj.range.start, this.name.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        //if the callee starts with a namespace name, transpile the name
        if (state.file.calleeStartsWithNamespace(this)) {
            return new NamespacedVariableNameExpression(this as DottedGetExpression | VariableExpression).transpile(state);
        } else {
            return [
                ...this.obj.transpile(state),
                '.',
                new SourceNode(this.name.range.start.line + 1, this.name.range.start.character, state.pathAbsolute, this.name.text)
            ];
        }
    }
}

export class XmlAttributeGetExpression implements Expression {
    constructor(
        readonly obj: Expression,
        readonly name: Identifier,
        readonly at: Token
    ) {
        this.range = Range.create(this.obj.range.start, this.name.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        return [
            ...this.obj.transpile(state),
            '@',
            new SourceNode(this.name.range.start.line + 1, this.name.range.start.character, state.pathAbsolute, this.name.text)
        ];
    }
}

export class IndexedGetExpression implements Expression {
    constructor(
        readonly obj: Expression,
        readonly index: Expression,
        readonly openingSquare: Token,
        readonly closingSquare: Token
    ) {
        this.range = Range.create(this.obj.range.start, this.closingSquare.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        return [
            ...this.obj.transpile(state),
            new SourceNode(this.openingSquare.range.start.line + 1, this.openingSquare.range.start.character, state.pathAbsolute, '['),
            ...this.index.transpile(state),
            new SourceNode(this.closingSquare.range.start.line + 1, this.closingSquare.range.start.character, state.pathAbsolute, ']')
        ];
    }
}

export class GroupingExpression implements Expression {
    constructor(
        readonly tokens: {
            left: Token;
            right: Token;
        },
        readonly expression: Expression
    ) {
        this.range = Range.create(this.tokens.left.range.start, this.tokens.right.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        return [
            new SourceNode(this.tokens.left.range.start.line + 1, this.tokens.left.range.start.character, state.pathAbsolute, '('),
            ...this.expression.transpile(state),
            new SourceNode(this.tokens.right.range.start.line + 1, this.tokens.right.range.start.character, state.pathAbsolute, ')')
        ];
    }
}

export class LiteralExpression implements Expression {
    constructor(
        readonly value: BrsType,
        range: Range
    ) {
        this.range = range ?? Range.create(-1, -1, -1, -1);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        let text: string;
        if (this.value.kind === ValueKind.String) {
            //escape quote marks with another quote mark
            text = `"${this.value.toString().replace(/"/g, '""')}"`;
        } else {
            text = this.value.toString();
        }

        return [
            new SourceNode(
                this.range.start.line + 1,
                this.range.start.character,
                state.pathAbsolute,
                text
            )
        ];
    }
}

export class ArrayLiteralExpression implements Expression {
    constructor(
        readonly elements: Array<Expression | CommentStatement>,
        readonly open: Token,
        readonly close: Token
    ) {
        this.range = Range.create(this.open.range.start, this.close.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        let result = [];
        result.push(
            new SourceNode(this.open.range.start.line + 1, this.open.range.start.character, state.pathAbsolute, '[')
        );
        let hasChildren = this.elements.length > 0;
        state.blockDepth++;

        for (let i = 0; i < this.elements.length; i++) {
            let previousElement = this.elements[i - 1];
            let element = this.elements[i];

            if (element instanceof CommentStatement) {
                //if the comment is on the same line as opening square or previous statement, don't add newline
                if (util.linesTouch(this.open, element) || util.linesTouch(previousElement, element)) {
                    result.push(' ');
                } else {
                    result.push(
                        '\n',
                        state.indent()
                    );
                }
                state.lineage.unshift(this);
                result.push(element.transpile(state));
                state.lineage.shift();
            } else {
                result.push('\n');

                result.push(
                    state.indent(),
                    ...element.transpile(state)
                );
                //add a comma if we know there will be another non-comment statement after this
                for (let j = i + 1; j < this.elements.length; j++) {
                    let el = this.elements[j];
                    //add a comma if there will be another element after this
                    if (el instanceof CommentStatement === false) {
                        result.push(',');
                        break;
                    }
                }
            }
        }
        state.blockDepth--;
        //add a newline between open and close if there are elements
        if (hasChildren) {
            result.push('\n');
            result.push(state.indent());
        }

        result.push(
            new SourceNode(this.close.range.start.line + 1, this.close.range.start.character, state.pathAbsolute, ']')
        );
        return result;
    }
}

/** A member of an associative array literal. */
export interface AAMemberExpression {
    /** The name of the member. */
    key: BrsString;
    keyToken: Token;
    colonToken: Token;
    /** The expression evaluated to determine the member's initial value. */
    value: Expression;
    range: Range;
}

export class AALiteralExpression implements Expression {
    constructor(
        readonly elements: Array<AAMemberExpression | CommentStatement>,
        readonly open: Token,
        readonly close: Token
    ) {
        this.range = Range.create(this.open.range.start, this.close.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState): Array<SourceNode | string> {
        let result = [];
        //open curly
        result.push(
            new SourceNode(this.open.range.start.line + 1, this.open.range.start.character, state.pathAbsolute, this.open.text)
        );
        let hasChildren = this.elements.length > 0;
        //add newline if the object has children and the first child isn't a comment starting on the same line as opening curly
        if (hasChildren && ((this.elements[0] instanceof CommentStatement) === false || !util.linesTouch(this.elements[0], this.open))) {
            result.push('\n');
        }
        state.blockDepth++;
        for (let i = 0; i < this.elements.length; i++) {
            let element = this.elements[i];
            let previousElement = this.elements[i - 1];
            let nextElement = this.elements[i + 1];

            //don't indent if comment is same-line
            if (element instanceof CommentStatement &&
                (util.linesTouch(this.open, element) || util.linesTouch(previousElement, element))
            ) {
                result.push(' ');

                //indent line
            } else {
                result.push(state.indent());
            }

            //render comments
            if (element instanceof CommentStatement) {
                result.push(...element.transpile(state));
            } else {
                //key
                result.push(
                    new SourceNode(element.keyToken.range.start.line + 1, element.keyToken.range.start.character, state.pathAbsolute, element.keyToken.text)
                );
                //colon
                result.push(
                    new SourceNode(element.colonToken.range.start.line + 1, element.colonToken.range.start.character, state.pathAbsolute, ':'),
                    ' '
                );

                //determine if comments are the only members left in the array
                let onlyCommentsRemaining = true;
                for (let j = i + 1; j < this.elements.length; j++) {
                    if ((this.elements[j] instanceof CommentStatement) === false) {
                        onlyCommentsRemaining = false;
                        break;
                    }
                }

                //value
                result.push(...element.value.transpile(state));
                //add trailing comma if not final element (excluding comments)
                if (i !== this.elements.length - 1 && onlyCommentsRemaining === false) {
                    result.push(',');
                }
            }


            //if next element is a same-line comment, skip the newline
            if (nextElement && nextElement instanceof CommentStatement && nextElement.range.start.line === element.range.start.line) {

                //add a newline between statements
            } else {
                result.push('\n');
            }
        }
        state.blockDepth--;

        //only indent the closing curly if we have children
        if (hasChildren) {
            result.push(state.indent());
        }
        //close curly
        result.push(
            new SourceNode(this.close.range.start.line + 1, this.close.range.start.character, state.pathAbsolute, this.close.text)
        );
        return result;
    }
}

export class UnaryExpression implements Expression {
    constructor(
        readonly operator: Token,
        readonly right: Expression
    ) {
        this.range = Range.create(this.operator.range.start, this.right.range.end);
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        return [
            new SourceNode(this.operator.range.start.line + 1, this.operator.range.start.character, state.pathAbsolute, this.operator.text),
            ' ',
            ...this.right.transpile(state)
        ];
    }
}

export class VariableExpression implements Expression {
    constructor(
        readonly name: Identifier,
        readonly namespaceName: NamespacedVariableNameExpression
    ) {
        this.range = this.name.range;
    }

    public readonly range: Range;

    public getName(parseMode: ParseMode) {
        return parseMode === ParseMode.BrightScript ? this.name.text : this.name.text;
    }

    transpile(state: TranspileState) {
        let result = [];
        //if the callee is the name of a known namespace function
        if (state.file.calleeIsKnownNamespaceFunction(this, this.namespaceName?.getName(ParseMode.BrighterScript))) {
            result.push(
                new SourceNode(
                    this.range.start.line + 1,
                    this.range.start.character,
                    state.pathAbsolute,
                    `${this.namespaceName.getName(ParseMode.BrightScript)}_${this.getName(ParseMode.BrightScript)}`
                )
            );

            //transpile  normally
        } else {
            result.push(
                new SourceNode(this.name.range.start.line + 1, this.name.range.start.character, state.pathAbsolute, this.name.text)
            );
        }
        return result;
    }
}

/**
 * This expression transpiles and acts exactly like a CallExpression,
 * except we need to uniquely identify these statements so we can
 * do more type checking.
 */
export class NewExpression implements Expression {
    constructor(
        readonly newKeyword: Token,
        readonly call: CallExpression
    ) {
        this.range = Range.create(this.newKeyword.range.start, this.call.range.end);
    }

    /**
     * The name of the class to initialize (with optional namespace prefixed)
     */
    public get className() {
        //the parser guarantees the callee of a new statement's call object will be
        //a NamespacedVariableNameExpression
        return this.call.callee as NamespacedVariableNameExpression;
    }

    public get namespaceName() {
        return this.call.namespaceName;
    }

    public readonly range: Range;

    public transpile(state: TranspileState) {
        return this.call.transpile(state);
    }
}

export class CallfuncExpression implements Expression {
    constructor(
        readonly callee: Expression,
        readonly operator: Token,
        readonly methodName: Identifier,
        readonly openingParen: Token,
        readonly args: Expression[],
        readonly closingParen: Token
    ) {
        this.range = Range.create(
            callee.range.start,
            (closingParen ?? args[args.length - 1] ?? openingParen ?? methodName ?? operator).range.end
        );
    }

    public readonly range: Range;

    public transpile(state: TranspileState) {
        let result = [];
        result.push(
            ...this.callee.transpile(state),
            new SourceNode(this.operator.range.start.line + 1, this.operator.range.start.character, state.pathAbsolute, '.callfunc'),
            new SourceNode(this.openingParen.range.start.line + 1, this.openingParen.range.start.character, state.pathAbsolute, '('),
            //the name of the function
            new SourceNode(
                this.methodName.range.start.line + 1,
                this.methodName.range.start.character,
                state.pathAbsolute,
                `"${this.methodName.text}"`
            ),
            ', '
        );
        //transpile args
        //callfunc with zero args never gets called, so pass invalid as the first parameter if there are no args
        if (this.args.length === 0) {
            result.push('invalid');
        } else {
            for (let i = 0; i < this.args.length; i++) {
                //add comma between args
                if (i > 0) {
                    result.push(', ');
                }
                let arg = this.args[i];
                result.push(...arg.transpile(state));
            }
        }
        result.push(
            new SourceNode(this.closingParen.range.start.line + 1, this.closingParen.range.start.character, state.pathAbsolute, ')')
        );
        return result;
    }
}

export class ConditionalExpression implements Expression {
    constructor(
        readonly test: Expression,
        readonly consequent: Expression,
        readonly alternate: Expression
    ) {
        this.range = Range.create(
            test.range.start,
            alternate.range.end
        );
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        let result = [];
        let [testExpressions, testVarExpressions, testUniqueNames] = this.getExpressionInfo(this.test);
        let [consequentExpressions, consequentVarExpressions, consequentUniqueNames] = this.getExpressionInfo(this.consequent);
        let [alternateExpressions, alternateVarExpressions, alternateUniqueNames] = this.getExpressionInfo(this.alternate);

        let allExpressions = [...testExpressions, ...consequentExpressions, ...alternateExpressions];
        let allUniqueVarNames = [...new Set([...testUniqueNames, ...consequentUniqueNames, ...alternateUniqueNames])];

        let mutatingExpressions = allExpressions.filter(e => e instanceof CallExpression || e instanceof CallfuncExpression || e instanceof DottedGetExpression);

        // - TODO - it doesn't look like we need to manipulate the variable names
        // we can assign m on scope, and it should be fine

        //FIXME - need to ensure I'm using SourceNode's correctly here - not sure how to do that yet
        if (mutatingExpressions.length > 0) {
            //we need to do a scope-safe ternary operation
            let scope = '{';
            // eslint-disable-next-line no-return-assign
            allUniqueVarNames.forEach(name => scope += `\n"${name}": name`);
            scope += '}';

            result.push(`bslib_scopeSafeTernary(`);
            result = result.concat(this.test.transpile(state));
            result.push(`, ${scope},`);
            result = result.concat(this.getScopedFunction(state, this.consequent, consequentUniqueNames));
            result = result.concat(this.getScopedFunction(state, this.alternate, alternateUniqueNames));
            result.push(')');
        } else {
            result.push(`bslib_simpleTernary(`);
            result = result.concat(this.test.transpile(state));
            result = result.concat(this.consequent.transpile(state));
            result = result.concat(this.alternate.transpile(state));
        }
        return result;
    }

    private getExpressionInfo(expression: Expression): [Expression[], Expression[], string[]] {
        const expressions = getAllExpressions(expression);
        const varExpressions = expressions.filter(e => e instanceof VariableExpression) as VariableExpression[];
        const uniqueVarNames = [...new Set(varExpressions.map(e => e.name.text))];
        return [expressions, varExpressions, uniqueVarNames];
    }

    private getScopedFunction(state: TranspileState, alternate: Expression, scopeVarNames: string[]): Array<string| SourceNode> {
        let result = [];
        let text = 'function(scope)\n';
        scopeVarNames.forEach(name => {
            text += `${name} = scope.${name}\n`;
        });
        result.push(text);
        result = result.concat(alternate.transpile(state));
        result.push('end function\n');
        return result;
    }
}

export class InvalidCoalescingExpression implements Expression {
    constructor(
        readonly consequent: Expression,
        readonly alternate: Expression
    ) {
        this.range = Range.create(
            consequent.range.start,
            alternate.range.end
        );
    }

    public readonly range: Range;

    transpile(state: TranspileState) {
        let result = [];
        let [consequentExpressions, consequentVarExpressions, consequentUniqueNames] = this.getExpressionInfo(this.consequent);
        let [alternateExpressions, alternateVarExpressions, alternateUniqueNames] = this.getExpressionInfo(this.alternate);

        let allExpressions = [...alternateExpressions];
        let allUniqueVarNames = alternateUniqueNames;

        let mutatingExpressions = allExpressions.filter(e => e instanceof CallExpression || e instanceof CallfuncExpression || e instanceof DottedGetExpression);

        // - TODO - it doesn't look like we need to manipulate the variable names
        // we can assign m on scope, and it should be fine

        //FIXME - need to ensure I'm using SourceNode's correctly here - not sure how to do that yet
        if (mutatingExpressions.length > 0) {
            //we need to do a scope-safe ternary operation
            let scope = '{';
            // eslint-disable-next-line no-return-assign
            allUniqueVarNames.forEach(name => scope += `\n"${name}": name`);
            scope += '}';

            result.push(`bslib_scopeSafeCoalesce(`);
            result = result.concat(this.consequent.transpile(state));
            result.push(`, ${scope},`);
            result = result.concat(this.getScopedFunction(state, this.alternate, alternateUniqueNames));
            result.push(')');
        } else {
            result.push(`bslib_simpleCoalesce(`);
            result = result.concat(this.consequent.transpile(state));
            result = result.concat(this.alternate.transpile(state));
            result.push(')');
        }
        return result;
    }

    private getExpressionInfo(expression: Expression): [Expression[], Expression[], string[]] {
        const expressions = getAllExpressions(expression);
        const varExpressions = expressions.filter(e => e instanceof VariableExpression) as VariableExpression[];
        const uniqueVarNames = [...new Set(varExpressions.map(e => e.name.text))];
        return [expressions, varExpressions, uniqueVarNames];
    }

    private getScopedFunction(state: TranspileState, alternate: Expression, scopeVarNames: string[]): Array<string| SourceNode> {
        let result = [];
        let text = 'function(scope)\n';
        scopeVarNames.forEach(name => {
            text += `${name} = scope.${name}\n`;
        });
        result.push(text);
        result = result.concat(alternate.transpile(state));
        result.push('end function\n');
        return result;
    }
}


/**
 * Walks an expression, getting all nested expressions
 * @param expression
 * @param expressions
 */
function getAllExpressions(expression: Expression, expressions: Expression[] = []): Expression[] {
    //TODO - I think this should live on the expression itself
    expressions.push(expression);

    if (expression instanceof VariableExpression) {
    } else if (expression instanceof BinaryExpression) {
        getAllExpressions(expression.left, expressions);
        getAllExpressions(expression.right, expressions);
    } else if (expression instanceof CallExpression) {
        expression.args.map(e => getAllExpressions(e, expressions));
    } else if (expression instanceof DottedGetExpression) {
        getAllExpressions(expression.obj, expressions);
    } else if (expression instanceof ArrayLiteralExpression) {
        expression.elements.map(e => getAllExpressions(e, expressions));
    } else if (expression instanceof AALiteralExpression) {
        expression.elements.forEach(e => {
            if (!(e instanceof CommentStatement)) {
                getAllExpressions(e.value, expressions);
            }
        });
    } else if (expression instanceof UnaryExpression) {
        getAllExpressions(expression.right, expressions);
    } else if (expression instanceof NewExpression) {
        getAllExpressions(expression.call, expressions);
    } else if (expression instanceof CallfuncExpression) {
        expression.args.map(e => getAllExpressions(e, expressions));
        getAllExpressions(expression.callee, expressions);
    } else if (expression instanceof ConditionalExpression) {
        getAllExpressions(expression.test, expressions);
        getAllExpressions(expression.consequent, expressions);
        getAllExpressions(expression.alternate, expressions);
    }
    return expressions;
}
