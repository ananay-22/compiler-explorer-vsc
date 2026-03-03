import * as assert from 'assert';
import CompilerExplorer from '../../compiler-explorer';

suite('Compiler Explorer Test Suite', () => {

    test('getSourceLineRange returns proper source mapping', () => {
        const ce = new CompilerExplorer();
        ce.currentData = {
            asm: [
                { text: "main:", source: null, labels: [] },
                { text: "  mov eax, 1", source: { file: null, line: 2 }, labels: [] },
                { text: "  ret", source: { file: null, line: 3 }, labels: [] }
            ],
            stdout: [],
            stderr: [],
            compilationOptions: [],
            code: 0
        } as any;

        const result = ce.getSourceLineRange(1);
        assert.strictEqual(result, 1); // Source line 2 -> offset-1 line 1

        const resultNull = ce.getSourceLineRange(0);
        assert.strictEqual(resultNull, null);
    });

});
