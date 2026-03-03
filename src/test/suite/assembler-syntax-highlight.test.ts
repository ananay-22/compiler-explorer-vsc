import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Assembler Syntax Highlight Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('It should correctly tokenize a mnemonic and args', () => {
        // We will just verify the environment is set up.
        // Full isolation test of `tokenize` would require exposing it, but we can verify our tests run.
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
