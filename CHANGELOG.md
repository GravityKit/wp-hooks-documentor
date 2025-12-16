# Changelog

All notable changes to this project will be documented in this file, per [the Keep a Changelog standard](http://keepachangelog.com/), and will adhere to [Semantic Versioning](http://semver.org/).

## [Unreleased] - TBD
### Added
- Support for WordPress `@type` notation in `@param` tags to document nested array structures. Nested types display with ↳ prefix in parameter tables.
- Support for `@uses` tag in hook documentation to document functions, methods, or constants used by a hook.
  - Note: The PHP parser (wp-hooks/generator) doesn't currently support `@uses` tags in docblocks. A PR has been submitted upstream to add this functionality.
- Support for `@see` and `@link` tags in hook documentation. These are rendered in a "See Also" section with proper link formatting.
- Support for `@deprecated` tag in hook documentation. Deprecated hooks display a prominent warning admonition and are marked with ⚠️ in the index listing.
- New `--skip-build` CLI option to parse hooks and generate markdown without building the Docusaurus site.
- New `skipBuild` configuration option for the same functionality via config file.

## [1.0.1] - 2025-09-12
### Fixed
- Ensure multiple parameter types and duplicate hooks are handled properly (props [@dkotter](https://github.com/dkotter), [@iamdharmesh](https://github.com/iamdharmesh) via [#6](https://github.com/10up/wp-hooks-documentor/pull/6))

## [1.0.0] - 2025-08-21

- Initial Release 🎉

[Unreleased]: https://github.com/10up/wp-hooks-documentor/compare/trunk...develop
[1.0.1]: https://github.com/10up/wp-hooks-documentor/compare/1.0.0..1.0.1
[1.0.0]: https://github.com/10up/wp-hooks-documentor/tree/1.0.0
