# Cursor prompt templates

Replace bracketed text. Start with the task-specific template and give only relevant context. Ask Cursor to read `AGENTS.md` first.

## Feature

```text
Read AGENTS.md. Add [feature] to [page or flow]. First inspect the relevant existing files and describe the smallest implementation. Preserve current structure and design. Implement only this scope, then report changed files and validation.
```

## Bug fix

```text
Read AGENTS.md. Investigate: [expected behavior] but [actual behavior] in [page or flow]. Trace the relevant code and identify the likely cause before editing. Make a focused fix, then report the cause, changed files, and validation.
```

## UI change

```text
Read AGENTS.md. Update [page/component] to [specific visual or responsive outcome]. Follow the existing colors, typography, spacing, and patterns in the relevant files. Keep behavior intact unless specified. Report changed files and how the result was checked.
```

## Refactor

```text
Read AGENTS.md. Refactor [specific code] to [specific goal] without changing its behavior or the UI. Inspect callers and related styles first; avoid unrelated cleanup. Explain the change and validation.
```

## Review

```text
Read AGENTS.md. Review the changes in [files or diff] for bugs, regressions, accessibility issues, and unintended scope. Do not edit files. List findings by severity with file and location; if none, say so and note any validation limits.
```
