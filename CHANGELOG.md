# Changelog

## [1.4.0](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v1.3.0...v1.4.0) (2026-06-15)


### Features

* add backup details drawer ([fd98431](https://github.com/MokoGuy/paddockcontrol-desktop/commit/fd98431e7121b18cacbf821bad4adff8122d71bc))
* add DB backup import, peek, and restore-from-file methods ([7dc447c](https://github.com/MokoGuy/paddockcontrol-desktop/commit/7dc447cee5a588deff8740ca151936b8e98455a4))
* add EnrollOSNative and EnrollPasswordMethod functions to App API ([079a547](https://github.com/MokoGuy/paddockcontrol-desktop/commit/079a5479694310d0c1a5882993dabc56bb6e9520))
* implement master key wrapping with multi-method unlock ([1becb7c](https://github.com/MokoGuy/paddockcontrol-desktop/commit/1becb7ca67a4f0f652630547ddce675a20fc9da4))
* update frontend for DB-only backup system ([a3df303](https://github.com/MokoGuy/paddockcontrol-desktop/commit/a3df303cee0528acb7e25281d5b0813d450adb68))


### Bug Fixes

* address Copilot review feedback on PR [#85](https://github.com/MokoGuy/paddockcontrol-desktop/issues/85) ([639947d](https://github.com/MokoGuy/paddockcontrol-desktop/commit/639947dcbd3745386a77ca2f498bccc7e706f7b8))
* guard DeleteLocalBackup with requireSetupOnly ([e6a07df](https://github.com/MokoGuy/paddockcontrol-desktop/commit/e6a07df9f86d09a7f5a8906b98abc53affba5f72))
* preserve original created_at on certificate import ([fb969e5](https://github.com/MokoGuy/paddockcontrol-desktop/commit/fb969e513c738558431f4c955f8c799184bc9892))
* reject unknown-schema (v0) backups on restore ([3f6b120](https://github.com/MokoGuy/paddockcontrol-desktop/commit/3f6b1204849ef051fd34fecffb4ea98db164f0f0))
* terminology for app unlocking ([f28ce7b](https://github.com/MokoGuy/paddockcontrol-desktop/commit/f28ce7b7322da8bcadf56b56c5359d519f100da4))
* validate Argon2id params before key derivation ([d3d4a13](https://github.com/MokoGuy/paddockcontrol-desktop/commit/d3d4a13dd8d9702c712334eb2ab37399c06f4ded))
* validate backup schema version before import/restore ([a3ce557](https://github.com/MokoGuy/paddockcontrol-desktop/commit/a3ce55762c87b10753517a798b9b7b428b69e4d8))


### Code Refactoring

* migrate Edit Configuration modal to drawer ([86d9958](https://github.com/MokoGuy/paddockcontrol-desktop/commit/86d99589de4e1986d4c9d05317fda41f612303f0))
* move plaintext wiping to EncryptPrivateKey callers ([7928f40](https://github.com/MokoGuy/paddockcontrol-desktop/commit/7928f40d799820ddff6f57444511fddb8ffb3746))
* remove JSON backup export/import infrastructure ([39cba0b](https://github.com/MokoGuy/paddockcontrol-desktop/commit/39cba0b572b6c8b97d03bf33e86fd115e8a98fac))
* wipe master-key copies after use ([53aef9f](https://github.com/MokoGuy/paddockcontrol-desktop/commit/53aef9f19ec5fb83844dbb2ea583709c6131bc82))


### Tests

* add backup import, peek, and restore test coverage ([5a84df6](https://github.com/MokoGuy/paddockcontrol-desktop/commit/5a84df68fd1df0ac50345e10e2e713ec65d930cf))
* add service-level tests and remove redundant crypto tests ([5912189](https://github.com/MokoGuy/paddockcontrol-desktop/commit/5912189c797de5555ec5f952d4e251dcaf5c1b8c))


### Documentation

* document DB-only backup architecture in CLAUDE.md ([f7e5543](https://github.com/MokoGuy/paddockcontrol-desktop/commit/f7e5543ef6ece932d50e35dd95b62a7b5ed576f5))
* update documentation for master key wrapping architecture ([c3bce6e](https://github.com/MokoGuy/paddockcontrol-desktop/commit/c3bce6ecbfac53161600462bfd24f17a4796d84b))

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
* AES-256-GCM encrypted private key storage with master key wrapping and Argon2id key derivation
* Local backup and restore with content summaries
* Auto-update and version checking from GitHub releases
* SQLite-based persistent storage with automatic migrations
* Setup wizard for first-time configuration
