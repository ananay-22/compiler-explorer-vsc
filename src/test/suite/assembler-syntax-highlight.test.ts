import * as assert from 'assert';
import * as vscode from 'vscode';
import { tokenize } from '../../assembler-syntax-highlight';
import { GodboltLabel } from '../../compiler-explorer-types';

suite('Assembler Syntax Highlight Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('It should correctly tokenize a mnemonic and args', () => {
        const sourceCode = 'main:\n        addiu   $sp, $sp, -16';
        let tokens = tokenize(sourceCode, undefined, undefined);
        assert.strictEqual(tokens.length, 3);

        // Label
        assert.strictEqual(tokens[0].type, 'Label');

        // Mnemonic
        assert.strictEqual(tokens[1].type, 'Mnemonic');

        // Args
        assert.strictEqual(tokens[2].type, 'Args');
    });

    test('It should tokenize empty strings without causing index exceptions', () => {
        const sourceCode = 'main:\n\n        addiu   $sp, $sp, -16'; // empty spacer line
        let tokens = tokenize(sourceCode, undefined, undefined);

        assert.strictEqual(tokens.length, 3); // label + mnemonic + args
        assert.strictEqual(tokens[0].type, 'Label');
    });

    test('It should tokenize undefined Godbolt labels properties without crash', () => {
        const sourceCode = 'main:\n        addiu   $sp, $sp, -16';

        // An empty array or incomplete array shouldn't crash
        let tokens = tokenize(sourceCode, [], undefined);
        assert.strictEqual(tokens.length, 3);
    });

    test('It should assign deterministic Rainbow types based on Source Maps', () => {
        const sourceCode = 'main:\n        addiu   $sp, $sp, -16';
        const sourceMap = [5, 5]; // Both lines map to C-code line 5
        let tokens = tokenize(sourceCode, undefined, sourceMap);

        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[0].type, 'Rainbow_5');
        assert.strictEqual(tokens[1].type, 'Rainbow_5');
        assert.strictEqual(tokens[2].type, 'Rainbow_5');
    });

    test('It should fallback to default types if sourceMap lookup is missing', () => {
        const sourceCode = 'main:\n        addiu   $sp, $sp, -16';
        const sourceMap = [null, 6]; // Line 1 map is missing 
        let tokens = tokenize(sourceCode, undefined, sourceMap);

        assert.strictEqual(tokens[0].type, 'Label');
        assert.strictEqual(tokens[1].type, 'Rainbow_6');
    });

});
