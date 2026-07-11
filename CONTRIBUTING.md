# Contributing Guidelines

Welcome to the MCMM UI project! To keep our codebase clean, readable, and maintainable, we enforce several code quality standards.

## Development Workflow

1. **Create a branch** for your feature or bug fix.
2. **Make your changes**.
3. **Run tests & linters** locally before committing. (Although our Git hooks will double-check your work).
4. **Commit** using standard semantic commit messages if possible.

## Coding Standards

We rely heavily on automated tools to enforce consistency.

### EditorConfig

We use a `.editorconfig` file. Most modern IDEs (VSCode, WebStorm) will automatically pick this up and ensure your indentation (2 spaces) and line endings (LF) match the project standard.

### JavaScript (ESLint & JSDoc)

We use vanilla JavaScript (ES6+ Modules) combined with **Alpine.js**.

- All functions and state objects must be documented using **JSDoc**.
- Run `npm run lint:js` to verify your code.
- If you add interactions that require backend data, add a `// TODO: Backend Hook - <Description>` comment.
- We strictly validate parameter types and returns. If a parameter's type is completely obvious and linting is overly aggressive, you can use `/* eslint-disable jsdoc/require-param-description */` at the top of the file, but prefer writing complete JSDoc annotations.

### CSS (Stylelint)

We use Vanilla CSS with a modified BEM syntax and deep usage of CSS Custom Properties (variables).

- Run `npm run lint:css` to verify CSS.
- Keep components isolated in their own CSS files (e.g., `docker.css`, `gameserver.css`).
- Use existing tokens (e.g., `var(--bg-panel)`, `var(--text-secondary)`) instead of hardcoding colors.

### HTML (HTML Validate)

We write semantic HTML5 and bind data declaratively using Alpine.js (`x-data`, `x-on`, etc.).

- Run `npm run lint:html` to verify HTML structure.
- Always provide accessibility tags (`aria-label`, `alt` texts).
- Ensure buttons have clear focus states.

## Committing Code

This project uses **Husky** and **Lint-Staged**. When you run `git commit`, our pre-commit hook automatically formats and lints your staged files.

- If the linter finds an error that it **can** auto-fix (like indentation or quotes), it will fix it and proceed.
- If it finds an error it **cannot** auto-fix (like a missing JSDoc tag or unused variable), the commit will be **blocked**. You must fix the issue before committing.
