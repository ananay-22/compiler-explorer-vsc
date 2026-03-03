# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.2]
### Fixed
- Fixed VSCode Settings UI visibility. Settings schemas no longer use multi-types so they are natively editable from the VSCode config UI.

## [0.4.1]

### Added
- Vibecoded by an AI agent similarly to digitaljs.
- CI/CD Release pipeline under `.github/workflows/release.yml`.
- UI features: Godbolt Compiler Explorer editor title and context menu icons.
- Syntax Highlighting for the Godbolt API ASM document via standard `asm` syntax assignment or hover integration.
- Hover mapping from ASM code to corresponding C code lines via Godbolt `source` parameter analysis.
- Test suites using Mocha to parse assembly syntax and mock Compiler Explorer API responses.

### Changed
- Refactored `src/compiler-view.ts` and `src/compiler-explorer.ts` to allow Godbolt hover mapping.
- Changed author and publisher information.

### Fixed
- Fixed the previous unhelpful command palette-only flow by integrating modern VSCode UI standards.

## [0.4.0] - Prior Release
- Initial base from MRobertEvers/vscode-compiler-explorer.
