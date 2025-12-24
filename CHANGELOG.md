# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
