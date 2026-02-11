# Changelog

## [1.1.2](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v1.1.1...v1.1.2) (2026-02-11)


### Code Refactoring

* centralize all download actions in an export action modal ([c9ee1dc](https://github.com/MokoGuy/paddockcontrol-desktop/commit/c9ee1dc54f3fb223f109b724926e2129c599da0d)), closes [#76](https://github.com/MokoGuy/paddockcontrol-desktop/issues/76)


### Tests

* add service-level tests and fix nil pointer dereferences ([8ede923](https://github.com/MokoGuy/paddockcontrol-desktop/commit/8ede9237d282b609eca4715cf1fa171bb3540b29))

## [1.1.1](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v1.1.0...v1.1.1) (2026-02-11)


### Bug Fixes

* various UI improvements for certificate detail page ([#70](https://github.com/MokoGuy/paddockcontrol-desktop/issues/70)) ([9efba78](https://github.com/MokoGuy/paddockcontrol-desktop/commit/9efba781ae0d9c58592f0bc7d93773e29901ddbe))


### Code Refactoring

* migrate download buttons into CodeBlock component ([32811ba](https://github.com/MokoGuy/paddockcontrol-desktop/commit/32811ba82b5ab4da8613d63e7470321c57dc5b32))

## [1.1.0](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v1.0.0...v1.1.0) (2026-02-11)


### Features

* PaddockControl Desktop v1.0.0 ([e906d5a](https://github.com/MokoGuy/paddockcontrol-desktop/commit/e906d5ada82fefa3d6b19d867cde662362b31e20))

## 1.0.0 (2026-02-11)

Initial public release of PaddockControl Desktop — a certificate management application for Windows.

### Features

* Certificate lifecycle management (CSR generation, certificate installation, renewal tracking)
* AES-encrypted private key storage with password-based access control
* Local backup and restore with content summaries
* Auto-update and version checking from GitHub releases
* SQLite-based persistent storage with automatic migrations
* Setup wizard for first-time configuration
