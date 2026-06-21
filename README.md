# TokeerDRM — Millennium plugin

Adds a **TokeerDRM** tab to a game's Properties dialog in Steam to apply and share
Denuvo activation tickets.

- **Activate with a code** — paste a 6-char code; the ticket is written to the
  registry and applied by OpenSteamTool, then launch the game normally.
- **Generate a code** — mints a ticket from your signed-in Steam account for a
  game you own and returns a shareable, single-use code (valid 30 min).

## Requirements

- [Millennium](https://steambrew.app/) (v3+) with Lua backend support.
- **OpenSteamTool** active in Steam (the plugin detects it and offers a one-click
  install if it's missing — Denuvo tickets won't apply without it).

## Install

Drop this folder into `<Steam>\millennium\plugins\TokeerDRM\` and enable it in
Millennium. The plugin checks for updates on open and force-prompts if outdated.

## Layout

- `backend/main.lua` — Lua backend (registry, HTTP, ticket extract, engine setup).
- `backend/extract_tickets.exe` — dumps AppTicket + ETicket for an owned game.
- `backend/install_ost.ps1` — installs/repairs OpenSteamTool.
- `.millennium/Dist/index.js` — the Properties-tab UI.
- `plugin.json` — Millennium manifest.
