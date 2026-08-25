# CoffeeShop POS

Offline-first point of sale for a coffee shop — **React + TypeScript + Tauri 2**.

Live demo: [coffeeshop-bagban.vercel.app](https://coffeeshop-bagban.vercel.app) — browser
build (data in localStorage, no Rust backend). Log in as `admin` / `admin123`.

Everything runs locally: orders, the product catalogue, ingredient stock, finances and
reports. There is no server, no account and no network call; the dataset is a single
JSON document in the operating system's application-data folder.

Data from earlier versions of the app carries over: their JSON and Excel exports can be
imported directly.

## Features

| Section | What it does |
| --- | --- |
| **Sales** | Category → product → size wizard, quantity, barista comments, discounts, cash/card, draft that survives a restart |
| **Orders** | Day filter, edit lines, add lines, change payment, finish an order, per-order change history |
| **Products** | Multiple sizes with their own cost, price and ingredient recipe |
| **Categories** | Named, colour-coded, used across the sales wizard and reports |
| **Discounts** | Configurable list: percentages, "free" and subscription sales |
| **Resources** | Ingredient stock, deducted automatically as orders are placed and edited |
| **Finance** | Revenue, profit and margin for today, this month, and a 7-day P&L |
| **Reports** | Top products, top categories, sales by weekday and by hour |
| **Users** | Three roles — two baristas (sales only) and an administrator (full access) |
| **Backups** | Snapshots on disk, restore, and Excel/JSON export & import |

Pricing rules carried over from the original app: a comment containing `+1 AZN` or
`+3 AZN` adds that surcharge to the unit price, `free` zeroes the line, and a percentage
discount applies after the surcharge.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- [Rust](https://www.rust-lang.org/tools/install) 1.77.2 or newer (only for the desktop build)
- The platform prerequisites listed in the
  [Tauri 2 guide](https://v2.tauri.app/start/prerequisites/) — WebView2 on Windows,
  Xcode command line tools on macOS, `webkit2gtk` and friends on Linux

On Windows the Rust host must be **MSVC** (`stable-x86_64-pc-windows-msvc`, which needs the
Visual Studio Build Tools "Desktop development with C++" workload). The GNU/MinGW host is
not usable: the crates compile and the bundler even produces working installers, but the
application window is never created — Tauri's Windows backend assumes the MSVC toolchain.

## Getting started

```bash
npm install
npm run tauri:dev      # desktop app with hot reload
npm run tauri:build    # installers in src-tauri/target/release/bundle
```

`npm run dev` alone opens the UI in a normal browser at <http://localhost:1420>. In that
mode the app stores its data in `localStorage` and uses browser download/upload instead
of native file dialogs, which is handy for UI work without the Rust toolchain.

Other scripts:

```bash
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + production web bundle
```

## Default accounts

A fresh install seeds three accounts:

| Login | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Administrator |
| `barista1` | `123` | Barista 1 |
| `barista2` | `123` | Barista 2 |

**Change these before using the app in a real shop.** Passwords are stored as SHA-256
digests and are never included in exports; the administrator account cannot be deleted
and survives "Clear all data" unless you say otherwise.

## Where the data lives

| Platform | Path |
| --- | --- |
| Windows | `%APPDATA%\com.nasraddinzade.coffeeshop\database.json` |
| macOS | `~/Library/Application Support/com.nasraddinzade.coffeeshop/database.json` |
| Linux | `~/.local/share/com.nasraddinzade.coffeeshop/database.json` |

Backups go into a `backups/` folder next to it. Writes are atomic — the database is
written to a temporary file and renamed — so a crash mid-save cannot corrupt it. A
snapshot is taken automatically before every import, restore and "Clear all data", and
the 30 most recent snapshots are kept.

## Migrating from an earlier version

1. In the old app: **Backups → Export Data**, choose either JSON or Excel.
2. In this app: **Backups → Import Data**, pick the file, then choose a strategy:
   - **Append** — add what is missing, skip anything that already exists;
   - **Merge** — add what is missing and update matching records;
   - **Replace** — wipe first, then import.

Old exports carry no passwords, so imported users get the password `123` and should
change it at once.

## Project layout

```
src/                 React UI
  components/        Shell, modals, toasts, charts
  sections/          One file per navigation section
  modals/            Order editor, item editor, product picker
  lib/               Pricing, reports, import/export, native bridge
  store/             Zustand store — the single source of truth
src-tauri/           Rust backend: atomic storage, backups, hashing, file I/O
scripts/             Icon generator (no image toolchain required)
```

The Rust side exposes a small command surface (`load_database`, `save_database`,
`create_backup`, `list_backups`, `read_backup`, `delete_backup`, `hash_password`,
`read_binary_file`, `write_binary_file`) and grants the window only the `core` and
`dialog` capabilities.

The webview runs without a custom Content-Security-Policy, matching the Tauri starter
template; the app loads no remote content, but if you fork it for something that does,
set `app.security.csp` in `src-tauri/tauri.conf.json`.

## Repository history

The app was built locally, without version control, and published here once it was
finished. That is why the history starts with an import of the completed project rather
than tracking the work commit by commit.

## Licence

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Ramin Nasraddinzade.
