import type { CodeActionKind, Diagnostic, Position, Range, WorkspaceEdit } from 'vscode-languageserver';
import { CodeAction, TextEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import type { SGComponent } from './parser/SGTypes';

export class CodeActionUtil {

    public createCodeAction(obj: CodeActionShorthand) {
        const edit = {
            changes: {}
        } as WorkspaceEdit;
        for (const change of obj.changes) {
            const uri = URI.file(change.filePath).toString();

            //create the edit changes array for this uri
            if (!edit.changes[uri]) {
                edit.changes[uri] = [];
            }
            if (change.type === 'insert') {
                edit.changes[uri].push(
                    TextEdit.insert(change.position, change.newText)
                );
            } else if (change.type === 'replace') {
                TextEdit.replace(change.range, change.newText);
            }
        }
        return CodeAction.create(obj.title, edit);
    }
    /**
     * Create an edit that properly handles inserting a script to the end of the component,
     * honoring the indentation
     */
    addXmlScript(component: SGComponent, uri: string) {
        //find the last script tag (if one exists)
        const lastScript = component.scripts[component.scripts.length - 1];
        //TODO
        if (lastScript) {
        }
        //find the closing interface tag
    }
}

export interface CodeActionShorthand {
    title: string;
    diagnostics?: Diagnostic[];
    kind?: CodeActionKind;
    isPreferred?: boolean;
    changes: Array<InsertChange | ReplaceChange>;
}

export interface InsertChange {
    filePath: string;
    newText: string;
    type: 'insert';
    position: Position;
}

export interface ReplaceChange {
    filePath: string;
    newText: string;
    type: 'replace';
    range: Range;
}

export const codeActionUtil = new CodeActionUtil();
export default codeActionUtil;

