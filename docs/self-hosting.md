# Self-hosting Home Pantry

Everything you need to run your own deployment. The README covers local development; this page covers running it for real.

## 1. Prerequisites

- Node.js (current LTS) and [pnpm](https://pnpm.io/)
- An [Appwrite](https://appwrite.io/) instance — either [Appwrite Cloud](https://appwrite.io/cloud) or a self-hosted server you control
- A copy of this repo

## 2. Create the Appwrite project and API key

1. In your Appwrite console, create a new project. Note its ID — this becomes `NEXT_PUBLIC_APPWRITE_PROJECT_ID`.
2. Create a Web platform in the project if you want to restrict origins.
3. Under the project's API keys, create a key scoped to `databases` (read + write). The `pnpm setup` and `pnpm seed` scripts use this key — it never reaches the browser.

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite-instance/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-databases-scoped-key
```

## 3. Create the schema and seed data

```bash
pnpm install
pnpm setup
pnpm seed
```

`pnpm setup` creates the database, collections, attributes, and indexes if they are missing, or verifies them if they already exist. `pnpm seed` loads sample categories, locations, and templates so the pantry is not empty on first run — you can delete the sample data from the UI afterwards.

Then start the dev server to try it out:

```bash
pnpm dev
```

## 4. The trust model: one shared pantry

Every signed-in user of a deployment sees and edits the **same pantry**. There is no per-user data isolation: locations, items, templates, and categories are shared with everyone who has an account.

Create accounts only for people you trust with everything. This is a household tool, not a multi-tenant service — if you need separate pantries, run separate deployments.

## 5. Optional AI provider

Text, photo, and voice parsing use any OpenAI-compatible endpoint. Configure it with:

- `AI_API_KEY`
- `AI_MODEL` (chat + vision)
- `AI_BASE_URL` (defaults to OpenRouter's endpoint)
- `AI_TRANSCRIBE_MODEL` (speech-to-text)

As a fallback, `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_TRANSCRIBE_MODEL` are used when the matching `AI_*` variable is unset.

AI is entirely optional — without a key, add-by-text/photo/voice is disabled and the rest of the app works normally. Provider calls happen in server actions only; keys stay server-side and are never exposed to the client. The exact prompts are documented in [ai-prompts.md](ai-prompts.md).

## 6. Wipe safety

`pnpm setup` never deletes anything by default. Wiping the pantry collections requires `SETUP_WIPE=1` (or `--wipe`) **and** an interactive y/N confirmation (default no) that names the endpoint, project, and database about to be wiped. If stdin is not a TTY, the wipe is refused unless you also set `SETUP_WIPE_CONFIRM=yes` after reviewing the target. There is no way to wipe silently.

## 7. Serve over HTTPS

HTTPS is required for two things: the PWA's service worker (Add to Home Screen / install) and the session cookie's secure behavior. Serving over plain HTTP on a LAN may work in a desktop browser but will break PWA install.

Build and start the production server:

```bash
pnpm build
pnpm start
```

This listens on port 3000 by default. Put it behind a reverse proxy that terminates TLS — Caddy, nginx, Traefik, or a cloud load balancer all work. Example Caddyfile:

```
pantry.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin so PWA metadata points at the right place, and keep `NEXT_PUBLIC_APPWRITE_ENDPOINT` on HTTPS as well.

Once the site is served over HTTPS, use your browser's Add to Home Screen / Install action — Home Pantry then runs full-screen and offline-capable like a native app.
