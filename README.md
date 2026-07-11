# MCMM UI Idea (GameServer Hub)

A modern, responsive, and dynamic UI plugin for Unraid, serving as a centralized dashboard for managing Docker-based game servers.

## Tech Stack

This project is built using a lightweight but powerful frontend stack:

- **Vanilla HTML5 & CSS3**: No heavy CSS frameworks. Custom CSS variables (CSS Custom Properties) and a tailored BEM-like methodology ensure maximum flexibility, rich aesthetics, and dark-mode support.
- **Vanilla JavaScript (ES Modules)**: Organized into discrete, maintainable modules without the overhead of Webpack or Babel.
- **Alpine.js**: Provides reactive state management and declarative DOM bindings right in the HTML (`x-data`, `x-show`, `x-on`, etc.).
- **xterm.js**: Used for the robust in-browser terminal console.

## Project Structure

```text
├── components/       # HTML fragments/components
├── css/              # Stylesheets, organized by feature/component
├── js/               # ES Modules controlling state and API interaction
│   ├── core-store.js # Central Alpine.js store (Single Source of Truth)
│   ├── main.js       # Entry point and global Alpine.js initialization
│   └── ...           # Panel controllers (docker.js, gameserver.js, etc.)
├── games/            # Game-specific modules (Minecraft, CS2, Palworld, etc.)
└── index.html        # Main Application View
```

## Development Setup

### Requirements

- Node.js (v22+)
- npm (v10+)

### Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the local development server:**

   ```bash
   npm run dev
   ```

   This will spin up a local live-reloading server (usually at `http://127.0.0.1:5500`).

## Documentation for Backend Integration

The frontend UI is fully prepared for a backend API integration. Throughout the JavaScript codebase, you will find `TODO: Backend Hook` comments. These are the specific locations where mock data or static stubs must be replaced with real `fetch()` calls to the Unraid or Docker API.

**To view the API documentation:**
We use JSDoc to generate an interactive documentation website for the JavaScript layer.

1. Generate the documentation:

   ```bash
   npm run docs
   ```

2. Serve the documentation locally:

   ```bash
   npm run docs:serve
   ```

## Code Quality & Linting

This project uses EditorConfig, ESLint, Stylelint, and HTML Validate to maintain a pristine codebase. Git Hooks (Husky) are set up to run these linters automatically on `git commit`.

To run linters manually:

```bash
npm run lint         # Runs all linters
npm run lint:fix     # Attempts to auto-fix linting issues
```

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for more details on our coding standards.

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.
See the [LICENSE.md](LICENSE.md) file for details. This means any modifications or derived works must also be open-source under the GPLv3 license.
