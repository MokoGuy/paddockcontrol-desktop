# Changelog

## [1.3.0](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v1.2.0...v1.3.0) (2026-02-12)


### Features

* add dashboard read-only toggle and move badge animations into components ([101852f](https://github.com/MokoGuy/paddockcontrol-desktop/commit/101852f1cfd1acff717928a9ef336ef5f34353b5)), closes [#63](https://github.com/MokoGuy/paddockcontrol-desktop/issues/63)


### Bug Fixes

* disable Go cache in release build to prevent cache key collision ([c510150](https://github.com/MokoGuy/paddockcontrol-desktop/commit/c5101503834d00d11212386715c1fd43fd836207)), closes [#75](https://github.com/MokoGuy/paddockcontrol-desktop/issues/75)


### Code Refactoring

* deduplicate motion animation wrappers ([8ce2216](https://github.com/MokoGuy/paddockcontrol-desktop/commit/8ce22163e514679a7012d29099e3bdf60debc554))
* disable motion animations in screenshot generation ([c9ac574](https://github.com/MokoGuy/paddockcontrol-desktop/commit/c9ac574fbf85003e7f534db76ea43e32c8b92887))

## [1.2.0](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v1.1.2...v1.2.0) (2026-02-11)


### Features

* automate README screenshot generation with Playwright ([33cefc6](https://github.com/MokoGuy/paddockcontrol-desktop/commit/33cefc6456b00563842e1cc046089c0d1151345d))


### Bug Fixes

* remove rounded corners to match squared design language ([c34f5f6](https://github.com/MokoGuy/paddockcontrol-desktop/commit/c34f5f67f49426dac3fe08b46bedffa63aa5ee08))
* render release notes as markdown in update card ([#79](https://github.com/MokoGuy/paddockcontrol-desktop/issues/79)) ([276544d](https://github.com/MokoGuy/paddockcontrol-desktop/commit/276544d8488b7b797009411b030c3d05bf75bf9f))
* smooth logo transition on theme toggle ([77b358b](https://github.com/MokoGuy/paddockcontrol-desktop/commit/77b358b89e0adb02e1239d4ac6f1d395b46d2085))
* use distinct purple color for renewal badge ([e32e399](https://github.com/MokoGuy/paddockcontrol-desktop/commit/e32e399524f07a5105f404787f3bef3bf1549c0f))


### Code Refactoring

* move cert detail actions inline with tabs ([938509e](https://github.com/MokoGuy/paddockcontrol-desktop/commit/938509e0e60bb8dd2a07d6c7661cb6c98f98ad0c))


### Documentation

* rewrite README, add CONTRIBUTING, LICENSE, and screenshots ([8f4c09b](https://github.com/MokoGuy/paddockcontrol-desktop/commit/8f4c09b4d8d6a1d7c4d2815ece6c3f14060cd89a)), closes [#80](https://github.com/MokoGuy/paddockcontrol-desktop/issues/80)

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
