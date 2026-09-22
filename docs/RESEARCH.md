# dashboard-builder — documentation research

Reviewed 21 September 2026. Public GitHub source only.

## Revision and scope

- Commit: [`3380553ec4c613c5f4877d478d32ccfc6657d657`](https://github.com/NickCirv/dashboard-builder/commit/3380553ec4c613c5f4877d478d32ccfc6657d657).
- Tree: `3820d20a643ff914315c2ae6e2221562c8a5bfd2`; truncated: `false`.
- Capture: 6 of 6 eligible text files; all eligible text files.
- Method: package and entrypoint inspection, implementation-interface review, targeted behavior/limitation inspection, and test-source review. This is not an exhaustive correctness or security audit.
- Commands run against repository code: **none**. External services, deployment and npm publication were not verified.

## Claim and evidence map

| Documentation claim | Pinned evidence | Assessment |
| --- | --- | --- |
| Runtime, executable and development commands | [package.json](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/package.json) | Source declaration inspected; runtime unverified |
| Builds a terminal dashboard configuration from a prompt and renders supported local widgets. | [index.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/index.js) | Implementation interfaces inspected; behavior not executed |
| Prompt/config workflow; local system and Git sources; saved dashboard JSON; timed refresh. | [index.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/index.js) | Source-backed scope, not a test result |
| Prompt-based configuration can call Anthropic with ANTHROPIC_API_KEY. Widget data and generated layouts need review; some widgets execute local shell commands. An interactive terminal is required. | [index.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/index.js) | Material limits documented; service compatibility remains open |
| Existing checks | [test/smoke.test.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/test/smoke.test.js) | Test source read; no passing-run claim |

## Documentation inventory and disposition

| Existing document | Decision |
| --- | --- |
| [README.md](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/README.md) | Rewritten with source-specific purpose, direct checkout setup, limitations and verification status. Old section fragments retained where practical. |

Added `docs/REFERENCE.md` for the observed implementation and command surface, and this research record. Protected license and attribution files remain in their original locations without edits. No source or product UI was changed.

## Quality dimensions

| Dimension | Status | Evidence / next step |
| --- | --- | --- |
| Pinned provenance | Verified | Captured commit, tree and per-file hashes recorded below |
| Interface documentation | Partially verified | Source inspection only; run clean-checkout quickstart |
| Runtime behavior | Unverified | No repository execution in this review |
| Test results | Unverified | Existing tests were not run |
| Deployment / package availability | Unverified | No remote publish or live-service check |
| Visual / link checks | Unverified | Portfolio renderer and independent QA are separate from this authoring step |

## Unresolved issues

Prompt-based configuration can call Anthropic with ANTHROPIC_API_KEY. Widget data and generated layouts need review; some widgets execute local shell commands. An interactive terminal is required.

## Captured source inventory

This lists captured provenance, not a claim that every line received a full audit. Binary/generated/excluded files are outside the eligible text capture.

| File | SHA-256 | Bytes |
| --- | --- | --- |
| [LICENSE](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/LICENSE) | `68729cab364d82364078b08d8580ccfa51dc69c81a7d64e8d8d47a1da6c9349d` | 1072 |
| [README.md](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/README.md) | `2ca1842d10ec8d77e5b20009df60c487cd34225cbeb3f8d1d61e242070253539` | 3921 |
| [package.json](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/package.json) | `ec544f9e5d425b515ed607afb28bfeff0d2bee3f99588d99277a58f70a00970e` | 562 |
| [.github/workflows/ci.yml](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/.github/workflows/ci.yml) | `e818f4e6bd805f798665dbbf04964d02f12fc59dd7f18903ad63d26d374ae3f0` | 380 |
| [index.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/index.js) | `8008f12e7baf6f1e93d6d640f6a7c37adf8f3cc7ccb65efe41d2be34c5a132c7` | 31424 |
| [test/smoke.test.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/test/smoke.test.js) | `1a21876fce1d7148992311342c9114e36a5249adac865ad0988db7d997043aba` | 334 |
