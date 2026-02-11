# PaddockControl Desktop

A desktop certificate management app for teams that handle SSL/TLS certificates with internal CAs.

[![CI](https://github.com/MokoGuy/paddockcontrol-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/MokoGuy/paddockcontrol-desktop/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/MokoGuy/paddockcontrol-desktop)](https://github.com/MokoGuy/paddockcontrol-desktop/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## About

PaddockControl Desktop simplifies the certificate lifecycle for organizations using internal Certificate Authorities. Generate CSRs, track certificate status, store private keys with AES encryption, and never lose track of expiring certificates again. Built with Go and React, it runs natively on Windows with auto-updates.

## Screenshots

### Welcome

| Light | Dark |
|-------|------|
| ![Welcome Light](docs/screenshots/welcome-light.png) | ![Welcome Dark](docs/screenshots/welcome-dark.png) |

### Dashboard

| Light | Dark |
|-------|------|
| ![Dashboard Light](docs/screenshots/dashboard-light.png) | ![Dashboard Dark](docs/screenshots/dashboard-dark.png) |

### Certificate Detail

| Light | Dark |
|-------|------|
| ![Detail Light](docs/screenshots/certificate-detail-light.png) | ![Detail Dark](docs/screenshots/certificate-detail-dark.png) |

## Features

- Generate CSRs with RSA 4096-bit keys
- Track certificate status (pending / active / expiring / expired)
- Import existing certificates
- AES-encrypted private key storage
- Backup & restore
- Dark / light theme
- Auto-updates
- Search & filter certificates

## Tech Stack

Go &middot; Wails v2 &middot; React 19 &middot; TypeScript &middot; SQLite &middot; Tailwind CSS v4

## Download

Download the latest Windows installer from [GitHub Releases](https://github.com/MokoGuy/paddockcontrol-desktop/releases/latest).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, commands, and conventions.

## License

MIT &mdash; see [LICENSE](LICENSE).
