# Changelog

## [0.1.2](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v0.1.1...v0.1.2) (2026-02-10)


### Features

* display backup content summary and fix badge alignment ([#61](https://github.com/MokoGuy/paddockcontrol-desktop/issues/61)) ([4d20d89](https://github.com/MokoGuy/paddockcontrol-desktop/commit/4d20d89e27c39fb1d7b9a02c23d13063f0aa2959))
* implement auto-update & version check from GitHub releases ([#64](https://github.com/MokoGuy/paddockcontrol-desktop/issues/64)) ([218910e](https://github.com/MokoGuy/paddockcontrol-desktop/commit/218910e4a442b9902fe03d0de23c556bfa2226d4))
* implement local backup management with creation, restoration, and deletion functionalities ([852d1b9](https://github.com/MokoGuy/paddockcontrol-desktop/commit/852d1b996e4082f8c50db93ed36abd681133f73c)), closes [#61](https://github.com/MokoGuy/paddockcontrol-desktop/issues/61)


### Bug Fixes

* display version as-is from backend instead of prepending v ([4600727](https://github.com/MokoGuy/paddockcontrol-desktop/commit/4600727634d770400f8af8567962aefe5c02eb15))
* strip v prefix from version injection to avoid duplicate in header ([f33787d](https://github.com/MokoGuy/paddockcontrol-desktop/commit/f33787d763dad7463f2c9a582e8551da6f7126bb))


### Code Refactoring

* extract AdminGatedButton and DangerZoneCard shared components ([b31b4a2](https://github.com/MokoGuy/paddockcontrol-desktop/commit/b31b4a22048954b67a0ed2776349509cebfb0ed9))


### Tests

* add service-level tests for local backup management ([#61](https://github.com/MokoGuy/paddockcontrol-desktop/issues/61)) ([56973fa](https://github.com/MokoGuy/paddockcontrol-desktop/commit/56973facf94cbf3f9ba24b6654cc7782c8f11019))


### Documentation

* update repository URLs from GitLab to GitHub ([e9c6696](https://github.com/MokoGuy/paddockcontrol-desktop/commit/e9c66969b864ff51580b10f25f853ad6259f592c))

## [0.1.1](https://github.com/MokoGuy/paddockcontrol-desktop/compare/v0.1.0...v0.1.1) (2026-02-10)


### Bug Fixes

* resolve ESLint errors for CI ([92c077a](https://github.com/MokoGuy/paddockcontrol-desktop/commit/92c077a0cc5b056a45dedb5c2d6aa02a83ba1003))
