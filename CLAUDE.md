# Claude Code Instructions for Dorman Lakely Cartography

## Build Process

**IMPORTANT: Always rebuild after making changes to source files.**

After making any changes to TypeScript files in `src/`, run:

```bash
npm run build
```

This will:

1. Auto-increment the build number in `build-info.json`
2. Compile TypeScript to `dist/main.js`

## Commands

- **Build**: `npm run build`
- **Watch mode**: `npm run watch`
- **Tests**: `npm test`
- **Lint**: `npm run lint`
- **Format**: `npm run format`

## Module Dependencies

This module requires these Foundry VTT modules to be installed:

- `tagger`
- `monks-active-tiles`
- `enhanced-region-behavior` (for elevation region behaviors)

## Version Management

- Increment version in `module.json` when releasing
- Build numbers auto-increment on each build
- Use `npm run release:patch|minor|major` for releases
