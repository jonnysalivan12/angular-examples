---
name: ngxs-state-generator
description: >
  Use when creating new NGXS state structure from scratch.
  Triggers: create state, new state, generate state, scaffold state, add state.
allowed-tools:
  - run_in_terminal
---

# NGXS State Generator

## Input

User provides:
- `path` — destination folder (e.g., `libs/state/users/`)
- `name` — state name in camelCase (e.g., `dashboardUsers`, `caseWizard`)

If not provided — ask.

## Execute

Run the script from this skill directory:

```bash
node .github/skills/ngxs-state-generator/scripts/generate-state.js <path> <name>
```

Do NOT create files manually. The script generates all files deterministically.

## After Generation

Inform user:
- State skeleton is ready
- Use `/ngxs-action-generator` to add sync actions
- Use `/ngxs-async-action-generator` to add async actions
- Register `<name>StateProviders()` in `app.config.ts` or route `providers`
