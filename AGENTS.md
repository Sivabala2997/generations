# Generations project guidance

- Inspect the relevant page, script, styles, and data before editing. Follow existing patterns and preserve the current structure, visual language, and behavior.
- Make the smallest focused change that fulfills the request. Avoid broad rewrites, unrelated cleanup, and speculative product features.
- Do not edit `color-sample.html` when changing the live site unless the request names it. Keep sample-only work separate from the main experience.
- Do not add dependencies, build tools, or configuration without first explaining why they are needed and asking the user.
- Preserve compatibility with the current plain HTML/CSS/JavaScript setup. Do not assume a framework, backend, or test suite exists.
- Check whether the project provides a relevant validation command before using one. For a change, validate the affected page or script with available project tooling; if none exists, state what was inspected and what could not be verified. Do not invent commands.
- Report the files changed, the behavior changed, and validation performed. Leave unrelated user changes intact.
