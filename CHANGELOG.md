# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-04-08

### Added

- Branded `dungeonmaster.guru` cross-promotion link in a new Map Gallery footer, alongside the Patreon link and version info. Uses the DM Guru logo and brand palette scoped under `.dlc-gallery-container`.
- Version info is now shown in the Map Gallery footer, read from the build-time `package.json` import.

## [1.1.1] - 2026-04-07

### Added

- **Runtime dependency version warnings**. When Tagger, Monk's Active Tiles, or Enhanced Region Behavior is installed and active but its manifest declares itself incompatible with the running Foundry version (i.e. `compatibility.maximum` is below the current Foundry major, or `compatibility.verified` is behind), a notification now fires on `ready` naming the specific dep and its declared max/verified version. Hard-cap mismatches are permanent notifications; stale-verified mismatches are transient. Only fires for deps that are present and active — the existing "not installed" warning path is untouched.

## [1.1.0] - 2026-04-06

### Added

- Foundry VTT v14 compatibility (`compatibility.verified` bumped to `14`, hard `maximum: "13"` cap removed). **Minimum Foundry version bumped to 14**. Earlier versions of this module remain available for v13 users from the GitHub releases page; this version is v14-only by design.

### Fixed

- **Scene creation now uses the document class lookup** instead of the bare `Scene` global. The download flow at `src/ui/download-dialog.ts:412` now resolves the Scene constructor through `getDocumentClass("Scene")` (with fallbacks to `foundry.documents.Scene` and the legacy `Scene` global) so map imports keep working if/when Foundry drops the bare global in a future release.

## [1.0.4] - 2026-03-24

### Fixed

- Improved Patreon login error handling — detect closed auth popup and stop polling early instead of waiting 2 minutes
- Clear user feedback for non-patrons: explains free maps are available without a subscription
- Better timeout/cancellation messages that guide users to free maps if authentication fails
- Differentiated success messages based on access tier (Premium, Free, or no active pledge)

## [1.0.3] - 2026-01-13

### Added

- chore: bump version to 1.0.1 and add auto-release workflow
- Add .env.production to gitignore
- Add environment variables to release workflow
- Add enhanced-region-behavior dependency and improve UI
- fix: add package-lock.json for reproducible CI builds
- chore: add .claude/settings.local.json to .gitignore
- release v1.0.0 with tier-based Patreon authentication
- Scene export and download improvements v0.2.0

### Fixed

- set pack system to dnd5e
- resolve all linting errors and test failures

### Changed

- bump version to 1.0.2
- Initial module setup v0.1.0

### Other

- Address Copilot review comments
- docs: rewrite README for end users instead of developers

## [1.0.2] - 2026-01-03

### Added

- chore: bump version to 1.0.1 and add auto-release workflow
- Add .env.production to gitignore
- Add environment variables to release workflow
- Add enhanced-region-behavior dependency and improve UI
- fix: add package-lock.json for reproducible CI builds
- chore: add .claude/settings.local.json to .gitignore
- release v1.0.0 with tier-based Patreon authentication
- Scene export and download improvements v0.2.0

### Fixed

- resolve all linting errors and test failures

### Changed

- Initial module setup v0.1.0

### Other

- Address Copilot review comments
- docs: rewrite README for end users instead of developers

## [1.0.1] - 2025-12-24

### Added

- Add .env.production to gitignore
- Add environment variables to release workflow
- Add enhanced-region-behavior dependency and improve UI
- fix: add package-lock.json for reproducible CI builds
- chore: add .claude/settings.local.json to .gitignore
- release v1.0.0 with tier-based Patreon authentication
- Scene export and download improvements v0.2.0

### Fixed

- resolve all linting errors and test failures

### Changed

- Initial module setup v0.1.0

### Other

- Address Copilot review comments
- docs: rewrite README for end users instead of developers

## [0.1.0] - 2025-01-XX

### Added

- Initial release of Dorman Lakely Cartography module
- Map gallery UI with grid view and detailed preview
- Tag-based filtering system for maps
- Search functionality for maps by name, description, keywords
- Patreon OAuth2 authentication integration
- Free and Premium access tier support
- Concurrent file download manager with progress tracking
- File upload service with Foundry storage integration
- Scene compendium pack structure
- LevelDB pack utilities for development workflow
- Comprehensive test suite with Jest
- TypeScript build system with Vite
- ESLint and Prettier configuration
- GitHub Actions CI/CD workflows
- Automated release management
- English localization

### Technical Details

- Built with TypeScript 5.9+ targeting ES2020
- Uses ApplicationV2 (Foundry v13+ modern API)
- Requires Monk's Active Tiles and Tagger modules
- Support for custom download paths
- Configurable concurrent download workers (1-10)
- Map data caching with configurable expiry
- Comprehensive API service layer
- Handlebars template system
- Custom CSS with dark theme

## [Unreleased]

### Planned Features

- Additional language support (French, Spanish, German)
- Map favorites/bookmarks system
- Download queue management
- Bulk download functionality
- Map rating and review system
- In-app map preview with zoom
- Integration with Dynamic Effects module
- Support for animated maps
- Custom map organization/folders
