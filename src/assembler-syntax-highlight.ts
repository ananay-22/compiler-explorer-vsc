import * as vscode from 'vscode';
import * as logger from './logger';
import { GodboltLabel } from './compiler-explorer-types';

interface Token {
    start: number;
    stop: number;
    type: string;
}


export function tokenize(sourceCode: string, labels?: Array<GodboltLabel[]>, sourceLineMap?: Array<number | null>): Array<Token> {
    let res: Array<Token> = [];

    let currentLineIndex = 0;
    let lineStart = 0;
    let sourceLines = sourceCode.split('\n');
    for (let line of sourceLines) {

        const mappedSourceLine = (sourceLineMap && currentLineIndex < sourceLineMap.length) ? sourceLineMap[currentLineIndex] : null;

        if (!line.startsWith(' ') && line.lastIndexOf(':') > 0) {
            // Label
            res.push({
                start: lineStart,
                stop: lineStart + line.lastIndexOf(':') + 1,
                type: mappedSourceLine !== null ? `Rainbow_${mappedSourceLine}` : 'Label'
            });
        }
        else {
            let splitLine = line.split('  ').filter(v => v);
            if (splitLine.length === 0) {
                lineStart += line.length + 1;
                currentLineIndex += 1;
                continue;
            }

            let token = splitLine[0];
            let start = lineStart + line.indexOf(token, 0);
            let end = start + token.length;
            res.push({
                start: start,
                stop: end,
                type: mappedSourceLine !== null ? `Rainbow_${mappedSourceLine}` : 'Mnemonic'
            });

            if (splitLine.length > 1) {

                let argType = 'Args';
                token = splitLine[1];
                start = lineStart + line.indexOf(token, end - lineStart);
                end = start + token.length;
                if (token.indexOf("\"") >= 0) {
                    argType = 'String';
                }

                res.push({
                    start: start,
                    stop: end,
                    type: mappedSourceLine !== null ? `Rainbow_${mappedSourceLine}` : argType
                });

                // If one of the args is a label, override
                if (labels && labels.length > currentLineIndex) {
                    const lineLabels = labels[currentLineIndex];

                    if (lineLabels) {
                        for (let labelInfo of lineLabels) {
                            res.push({
                                start: lineStart + labelInfo.range.startCol,
                                stop: lineStart + labelInfo.range.endCol,
                                type: "LabelArg"
                            });
                        }
                    }
                }
            }


            if (splitLine.length > 2) {
                token = splitLine.splice(2).join(' ');
                start = lineStart + line.indexOf(token, end - lineStart);
                end = start + token.length;
                res.push({
                    start: start,
                    stop: end,
                    type: mappedSourceLine !== null ? `Rainbow_${mappedSourceLine}` : 'Comment'
                });
            }
        }

        lineStart += line.length + 1;
        currentLineIndex += 1;
    }

    return res;
}

let baseDecoration = {};

const typeMap = {
    'String': vscode.window.createTextEditorDecorationType({
        ...baseDecoration,
        color: '#c39178'

    }),
    'Args': vscode.window.createTextEditorDecorationType({
        ...baseDecoration,
        color: '#9cdcda'
    }),
    'LabelArg': vscode.window.createTextEditorDecorationType({
        ...baseDecoration,
        color: '#2a8081',
        fontStyle: 'italic',
        // borderWidth: '1px',
        // borderColor: 'red',
        // borderStyle: 'solid'
    }),
    'Comment': vscode.window.createTextEditorDecorationType({
        ...baseDecoration,
        color: '#438a55'

    }),
    'Mnemonic': vscode.window.createTextEditorDecorationType({
        ...baseDecoration,
        color: '#3e9cd6'
    }),
    'Label': vscode.window.createTextEditorDecorationType({
        ...baseDecoration,
        color: '#2a8081'
    }),
}

export interface DecorationSpecification {
    type: vscode.TextEditorDecorationType;
    ranges: Array<vscode.DecorationOptions>;
}

export function getSyntaxHighlightDecorationTypes(): any {
    return typeMap;
}

// Generate a deterministic soft pastel color based on an integer ID
function generateRainbowColor(id: number): string {
    const hue = (id * 137.5) % 360; // Spread hues evenly
    return `hsla(${hue}, 70%, 50%, 0.15)`; // 15% opacity to not overwhelm text
}

export function getSyntaxHighlightDecorations(editor: vscode.TextEditor, content: string, labels?: Array<GodboltLabel[]>, sourceMap?: Array<number | null>): Array<DecorationSpecification> {
    try {
        let res: Array<DecorationSpecification> = [];
        let typedBuckets = {};
        let tokens = tokenize(content, labels, sourceMap);
        for (const token of tokens) {
            if (!typedBuckets[token.type]) {
                typedBuckets[token.type] = [];
            }
            typedBuckets[token.type].push(
                new vscode.Range(
                    editor.document.positionAt(token.start),
                    editor.document.positionAt(token.stop),
                )
            );
        }

        // We must have an entry for each type or old ranges of that type will persist.
        // Includes dynamic rainbow types discovered during tokenization
        for (let typename of Object.keys(typedBuckets)) {
            let ranges = typedBuckets[typename];

            let decoType = typeMap[typename];
            if (!decoType && typename.startsWith('Rainbow_')) {
                const mappedLineId = parseInt(typename.replace('Rainbow_', ''), 10);
                decoType = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    backgroundColor: generateRainbowColor(mappedLineId)
                });
                typeMap[typename] = decoType; // Cache it
                logger.info(`getSyntaxHighlightDecorations: Created new DecoType for ${typename}`);
            }

            if (decoType && ranges && ranges.length > 0) {
                res.push({
                    type: decoType,
                    ranges: ranges
                });
            }
        }

        logger.info(`getSyntaxHighlightDecorations: Returning ${res.length} decoration specifications`);
        return res;
    } catch (e) {
        let err = e as Error;
        logger.info(`getSyntaxHighlightDecorations THREW ERROR: ${err.message}`);
        logger.info(`STACK: ${err.stack}`);
        return [];
    }
}