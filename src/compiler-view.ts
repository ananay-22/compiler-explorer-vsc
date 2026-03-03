import * as vscode from 'vscode';
import * as logger from './logger';
import CompilerExplorer from './compiler-explorer';
import CompilerExplorerSourceProvider from './compiler-source-provider';
import { GodboltLabel } from './compiler-explorer-types';
import { getSyntaxHighlightDecorations, DecorationSpecification, getSyntaxHighlightDecorationTypes } from './assembler-syntax-highlight';
import { getCompilerExplorerHost } from './config';
import fetch from 'node-fetch';

const highlightDecorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
    borderWidth: '1px',
    borderStyle: 'solid',
    isWholeLine: true,
    overviewRulerColor: 'blue',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    // this color will be used in dark color themes
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    borderColor: '#373737'
});

export default class CompilerView {
    private currentMnemonicsEditor: vscode.TextEditor | null;
    private currentSourceEditor: vscode.TextEditor | null;

    private currentMnemonicsDecorations: Array<DecorationSpecification> = [];
    private currentLabels: Array<GodboltLabel[]> = [];
    private compilerExplorer: CompilerExplorer = new CompilerExplorer();
    private compilerSourceProvider: CompilerExplorerSourceProvider = new CompilerExplorerSourceProvider(this.compilerExplorer);

    private supportedCompilers = this.getSupportedCompilers();
    activate(context: vscode.ExtensionContext) {
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (this.currentSourceEditor && this.currentMnemonicsEditor &&
                editor.document !== this.currentSourceEditor.document &&
                editor.document !== this.currentMnemonicsEditor.document) {
                this.clearSyntaxHighlighting();
                vscode.commands.executeCommand('compiler-explorer.updateDisassembly');
            }
        });

        // vscode.window.onDidChangeTextEditorVisibleRanges(editor => {
        //     // Scroll in assembly.
        // });

        vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
            if (!this.currentSourceEditor) {
                return;
            }

            if (this.currentSourceEditor && event.textEditor.document === this.currentSourceEditor.document) {
                logger.info(`Selection Changed: Source Editor at line ${event.textEditor.selection.active.line}`);
                this.clearHighlightedLines();
                this.highlightMnemonicsLines(event.textEditor.selection.active.line);
            }
            else if (this.currentMnemonicsEditor && event.textEditor.document === this.currentMnemonicsEditor.document) {
                // Ensure we don't log repeatedly if we're just clicking around the same file 
                // logger.info(`Selection Changed: Mnemonics Editor at line ${event.textEditor.selection.active.line}`);
                this.clearHighlightedLines();
                this.highlightSourceLines(event.textEditor.selection.active.line);
            }
        });

        vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
            vscode.commands.executeCommand('compiler-explorer.updateDisassembly');
        });

        vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) => {
            if (this.currentMnemonicsEditor && doc === this.currentMnemonicsEditor.document) {
                this.setCurrentMnemonicsEditor(null);
            }
        });

        vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
            if (this.currentMnemonicsEditor && event.document === this.currentMnemonicsEditor.document) {
                // Only clear if the content ACTUALLY changed (not just decorators)
                if (event.contentChanges.length > 0) {
                    this.currentMnemonicsDecorations = [];
                    this.syntaxHighlightMnemonics();
                }
            }
        });

        vscode.workspace.registerTextDocumentContentProvider('compiler-explorer', this.compilerSourceProvider);

        vscode.commands.registerCommand('compiler-explorer.updateDisassembly', () => { this.updateCompilerExplorer(); });
        vscode.commands.registerCommand('compiler-explorer.open', () => { this.showCompilerExplorer(); });
    }

    private async showCompilerExplorer() {
        if (!this.canShowCompilerExplorer()) {
            return; // no editor
        }

        const uri: vscode.Uri = vscode.Uri.parse('compiler-explorer:' + 'CompilerExplorer');

        // Calls back into the provider
        let newDocument: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);

        this.setCurrentSourceEditor(vscode.window.activeTextEditor);
        const result: vscode.TextEditor = await vscode.window.showTextDocument(newDocument, vscode.ViewColumn.Beside);
        this.setCurrentMnemonicsEditor(result);

        logger.info(`Compiler Explorer Opened: currentSourceEditor is ${!!this.currentSourceEditor}, newDocument is ${newDocument.uri}`);

        this.currentMnemonicsDecorations = [];
        this.syntaxHighlightMnemonics();

        await vscode.commands.executeCommand('workbench.action.navigateBack');
    }

    private async updateCompilerExplorer() {
        if (!this.canShowCompilerExplorer()) {
            return;
        }

        this.clearSyntaxHighlighting();
        this.clearHighlightedLines();

        // If the event is coming from the EditorChanged event, we need to update the editor.
        this.setCurrentSourceEditor(vscode.window.activeTextEditor);

        this.compilerSourceProvider.onDidChangeEmitter.fire(this.currentMnemonicsEditor.document.uri);
    }

    private setCurrentMnemonicsEditor(editor: vscode.TextEditor) {
        this.currentMnemonicsEditor = editor;
    }

    private setCurrentSourceEditor(editor: vscode.TextEditor) {
        this.currentSourceEditor = editor;
        this.clearHighlightedLines();
    }

    private canShowCompilerExplorer(): boolean {
        if (!vscode.window.activeTextEditor) {
            return false; // no editor
        }
        const lang: string = vscode.window.activeTextEditor.document.languageId;
        if (lang == 'c' || lang == 'c++' || lang == 'cpp') {
            return true;
        }
        else if (lang == 'python') {
            return true;
        }
        else if (lang == 'java') {
            return true;
        }
        this.supportedCompilers.then(res => {
            if (res.includes(lang)) {
                return true;
            }
        });
        //if some language is completely unsupported return false
        //for now this will always return true to enable the default lang usage
        return false;
    }

    private getBaseMnemonicsDecorations(): Array<DecorationSpecification> {
        if (this.currentMnemonicsDecorations.length == 0) {
            const asmText = this.currentMnemonicsEditor.document.getText();
            logger.info(`getBaseMnemonicsDecorations: Text length to Tokenize is ${asmText.length} chars...`);

            // Compute an array where each index corresponds to an ASM line number, 
            // and the value is the Source (C/C++) line number mapped to it
            // This allows the tokenizer to assign the exact same background color to related blocks
            const lineCount = this.currentMnemonicsEditor.document.lineCount;
            let sourceMap = new Array<number | null>(lineCount).fill(null);
            for (let i = 0; i < lineCount; i++) {
                sourceMap[i] = this.compilerExplorer.getSourceLineRange(i);
            }

            this.currentMnemonicsDecorations = getSyntaxHighlightDecorations(
                this.currentMnemonicsEditor, asmText, this.getCurrentLabels(), sourceMap
            );
            logger.info(`getBaseMnemonicsDecorations: Parsed ${this.currentMnemonicsDecorations.length} distinct syntax colors`);
        }

        return this.currentMnemonicsDecorations.slice(0);
    }

    private getCurrentLabels(): Array<GodboltLabel[]> {
        if (this.currentLabels.length == 0) {
            this.currentLabels = this.compilerExplorer.getAdditionalLabelInfo();
        }

        return this.currentLabels;
    }

    private syntaxHighlightMnemonics(): void {
        if (!this.currentMnemonicsEditor) {
            logger.info('syntaxHighlightMnemonics: currentMnemonicsEditor is null');
            return;
        }

        const decoratedRanges: Array<DecorationSpecification> = this.getBaseMnemonicsDecorations();
        logger.info(`syntaxHighlightMnemonics: Applying ${decoratedRanges.length} decoration specs`);

        for (let decoration of decoratedRanges) {
            this.currentMnemonicsEditor.setDecorations(decoration.type, decoration.ranges);
        }
    }

    private getSourceLineRange(disassembledLine: number): vscode.Range {
        let lineNum = this.compilerExplorer.getSourceLineRange(disassembledLine);

        // If clicking a blank or spacer Assembly line, try scanning a few lines up to find the nearest mapping
        let scanLine = disassembledLine;
        while (!lineNum && scanLine > 0 && disassembledLine - scanLine < 5) {
            scanLine--;
            lineNum = this.compilerExplorer.getSourceLineRange(scanLine);
        }

        if (!lineNum) {
            return null;
        }

        const line = this.currentMnemonicsEditor.document.lineAt(lineNum);
        return new vscode.Range(line.range.start, line.range.end)
    }

    private getDisassembledLineRange(sourceLine: number): vscode.Range {
        let result = this.compilerExplorer.getDisassembledLineRange(sourceLine);
        if (!result) {
            return null;
        }

        const [startLine, endLine] = result;
        const startPosition = this.currentMnemonicsEditor.document.lineAt(startLine).range.start;
        const endPosition = this.currentMnemonicsEditor.document.lineAt(endLine).range.end;

        return new vscode.Range(startPosition, endPosition);
    }

    private clearSyntaxHighlighting() {
        if (!this.currentMnemonicsEditor) {
            return;
        }
        let clearedSyntaxTypes = getSyntaxHighlightDecorationTypes();
        for (let type of Object.keys(clearedSyntaxTypes)) {
            this.currentMnemonicsEditor.setDecorations(clearedSyntaxTypes[type], []);
        }
    }

    private clearHighlightedLines() {
        if (this.currentMnemonicsEditor) {
            this.currentLabels = [];
            this.currentMnemonicsDecorations = [];
            this.currentMnemonicsEditor.setDecorations(highlightDecorationType, []);
        }
        if (this.currentSourceEditor) {
            this.currentSourceEditor.setDecorations(highlightDecorationType, []);
        }
    }

    private highlightMnemonicsLines(sourceLine: number): void {
        logger.info(`highlightMnemonicsLines: Source line clicked: ${sourceLine}`);
        const highlightRange = this.getDisassembledLineRange(sourceLine);
        if (!highlightRange) {
            logger.info(`highlightMnemonicsLines: No mapping found for source line ${sourceLine}`);
            this.clearHighlightedLines();
            return;
        }

        logger.info(`highlightMnemonicsLines: highlighting ASM range [${highlightRange.start.line}, ${highlightRange.end.line}]`);
        this.syntaxHighlightMnemonics();

        let highlightDecorations: vscode.DecorationOptions[] = [];
        highlightDecorations.push({
            range: highlightRange
        });

        this.currentMnemonicsEditor.setDecorations(highlightDecorationType, highlightDecorations);
        this.currentMnemonicsEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }

    private highlightSourceLines(disassembledLine: number): void {
        logger.info(`highlightSourceLines: ASM line clicked: ${disassembledLine}`);
        const highlightRange = this.getSourceLineRange(disassembledLine);
        if (!highlightRange) {
            logger.info(`highlightSourceLines: No mapping found for ASM line ${disassembledLine}`);
            this.clearHighlightedLines();
            return;
        }

        logger.info(`highlightSourceLines: highlighting C range [${highlightRange.start.line}, ${highlightRange.end.line}]`);
        this.syntaxHighlightMnemonics();

        let highlightDecorations: vscode.DecorationOptions[] = [];
        highlightDecorations.push({
            range: highlightRange
        });

        this.currentSourceEditor.setDecorations(highlightDecorationType, highlightDecorations);
        this.currentSourceEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    async getSupportedCompilers() {
        const apiHost = getCompilerExplorerHost();
        return await (await fetch(`${apiHost}/api/compilers`)).text();
    }
    /*
    private getLanguageIdentifier(lang : string) : string {
        switch (lang) {
            case 'go':
                return 'gc';
            case 'java':
                return 'jdk'
            default:
                break;
        }
    }*/
}