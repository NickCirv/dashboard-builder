# dashboard-builder — implementation reference

Source revision: `3380553ec4c613c5f4877d478d32ccfc6657d657`. This reference records source declarations; it is not a transcript of a successful run.

## Entrypoint and runtime

[package.json](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/package.json) declares `index.js`. Node.js `>=20` and npm; Git is also used by the implementation.

Executable mapping: `dashboard-builder` → `./index.js`.

## Supported workflow

Prompt/config workflow; local system and Git sources; saved dashboard JSON; timed refresh.

Prompt-based configuration can call Anthropic with ANTHROPIC_API_KEY. Widget data and generated layouts need review; some widgets execute local shell commands. An interactive terminal is required.

## Command reference

The commands below use the installed executable name. From the pinned checkout, replace it with the `node` entrypoint shown above. Options and command branches were cross-checked against captured source; examples are not execution transcripts.

| Flag | Description |
|------|-------------|
| `--git` | Git log, status, and changed files |
| `--system` | CPU load, memory, disk, uptime |
| `--dev` | CPU + recent commits + npm scripts |
| `--focus` | Pomodoro timer + commits + TODO count |
| `--project` | Auto-detected project info + git + memory |
| `--list` | Print all available preset names |
| `--save <file.json>` | Generate config and save to file |
| `--load <file.json>` | Run a previously saved config |
| `--preview <name>` | Print a preset's JSON config |

## Package scripts

| Script | Exact command |
| --- | --- |
| `test` | `node --test` |

## Environment references

The implementation reads `ANTHROPIC_API_KEY`. Some are optional or mode-specific; inspect their call sites before configuring a service. Credentials and endpoint values are never supplied by this document.

## Implementation sources

[index.js](https://github.com/NickCirv/dashboard-builder/blob/3380553ec4c613c5f4877d478d32ccfc6657d657/index.js).

## Verification boundary

No repository code, tests, network operation, hook installer or migration was executed for this review. Source inspection supports the documented interface; runtime correctness and external-service compatibility remain unverified.
