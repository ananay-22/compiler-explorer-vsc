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

    test('getSourceLineRange handles missing source maps robustly', () => {
        const ce = new CompilerExplorer();
        ce.currentData = {
            asm: [
                { text: "main:", source: null, labels: [] },
                { text: "  mov eax, 1", source: { file: null, line: undefined }, labels: [] },
                { text: "  ret", labels: [] }
            ]
        } as any;

        assert.strictEqual(ce.getSourceLineRange(0), null);
        assert.strictEqual(ce.getSourceLineRange(1), null);
        assert.strictEqual(ce.getSourceLineRange(2), null);
        assert.strictEqual(ce.getSourceLineRange(5), null); // out of bounds
    });

    test('getDisassembledLineRange computes bounds of matching C-lines correctly', () => {
        const ce = new CompilerExplorer();
        ce.currentData = {
            asm: [
                { text: "main:", source: null, labels: [] },
                { text: "  push rbp", source: { file: null, line: 2 }, labels: [] },
                { text: "  mov rbp, rsp", source: { file: null, line: 2 }, labels: [] },
                { text: "  nop", source: { file: null, line: 3 }, labels: [] },
                { text: "  pop rbp", source: null, labels: [] },
                { text: "  ret", source: { file: null, line: 4 }, labels: [] }
            ]
        } as any;

        // C-line 1 (0-indexed) -> Godbolt line 2. It maps to ASM lines 1 and 2
        let bounds = ce.getDisassembledLineRange(1);
        assert.deepStrictEqual(bounds, [1, 2]);

        // C-line 2 -> Godbolt line 3. Maps to ASM line 3
        bounds = ce.getDisassembledLineRange(2);
        assert.deepStrictEqual(bounds, [3, 3]);

        // C-line index that doesn't exist
        bounds = ce.getDisassembledLineRange(10);
        assert.strictEqual(bounds, null);
    });

    test('Godbolt Map bindings fail gracefully when currentData is null', () => {
        const ce = new CompilerExplorer();
        assert.strictEqual(ce.getSourceLineRange(1), null);
        assert.strictEqual(ce.getDisassembledLineRange(1), null);
        assert.throws(() => ce.getAdditionalLabelInfo()); // Expected to throw because it relies on map without null conditional inside the func
    });

});
