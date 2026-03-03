import * as vscode from 'vscode';
import * as logger from './logger'
import CompilerExplorer from './compiler-explorer';


export default class CompilerExplorerSourceProvider implements vscode.TextDocumentContentProvider {

    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

    private compilerExplorer: CompilerExplorer;

    get onDidChange() {
        return this.onDidChangeEmitter.event;
    }

    constructor(compilerExplorer: CompilerExplorer) {
        this.compilerExplorer = compilerExplorer;
    }

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        const sourceCode = vscode.window.activeTextEditor.document.getText();
        const lang = vscode.window.activeTextEditor.document.languageId;
        const text = await this.compilerExplorer.compile(lang, sourceCode);

        if (!text) {
            logger.info(`Compiler Explorer Document Provider: Assembled text is empty.`);
            return '// <No code compiled>';
        }
        logger.info(`Compiler Explorer Document Provider: Provided mapped ASM block of ${text.length} characters.`);
        return text;
    }
};
