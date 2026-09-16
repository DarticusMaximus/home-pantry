# Self-hosting Home Pantry

Everything you need to run your own deployment. The README covers local development; this page covers running it for real.

## 1. Prerequisites

- Node.js (current LTS) and [pnpm](https://pnpm.io/)
- An [Appwrite](https://appwrite.io/) instance — either [Appwrite Cloud](https://appwrite.io/cloud) or a self-hosted server you control
- A copy of this repo

## 2. Create the Appwrite project and API key

1. In your Appwrite console, create a new project. Note its ID — this becomes `NEXT_PUBLIC_APPWRITE_PROJECT_ID`.
2. Create a Web platform in the project if you want to restrict origins.
3. Under the project's API keys, create a key scoped to `databases` (read + write). The `pnpm setup`, `pnpm seed`, and `pnpm provision` scripts use this key — it never reaches the browser. Docker users can skip section 3: pass the same key as `APPWRITE_API_KEY` to the image (section 8) and the container provisions the schema itself.

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite-instance/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-databases-scoped-key
```

## 3. Create the schema and seed data

```bash
pnpm install
pnpm provision
```

`pnpm provision` is the one-command form: it creates the database, collections, attributes, and indexes if they are missing, then loads sample categories, locations, and templates so the pantry is not empty on first run. You can still run `pnpm setup` then `pnpm seed` separately if you prefer — you can delete the sample data from the UI afterwards.

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

Keep `NEXT_PUBLIC_APPWRITE_ENDPOINT` on HTTPS.

Once the site is served over HTTPS, use your browser's Add to Home Screen / Install action — Home Pantry then runs full-screen and offline-capable like a native app.

## 8. Run the Docker image

Every tagged release publishes a prebuilt image to `ghcr.io/darticusmaximus/home-pantry`, with both `1.0.0`-style version tags and `latest`. The image replaces the `pnpm build` / `pnpm start` step above — you still need the Appwrite project from section 2. Pass `APPWRITE_API_KEY` to the container at start: the image provisions the database and starter data itself, then removes the key from the app's environment; no checkout is needed. Provisioning is create-if-missing and never wipes existing data: restarting against a provisioned database duplicates nothing. If provisioning fails, the container exits immediately (fail-fast). The compose `restart: unless-stopped` policy below will retry a failed start — fix the key or Appwrite reachability rather than assuming the app is up.

```bash
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite.example/v1 \
  -e NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id \
  -e APPWRITE_API_KEY=your-databases-scoped-key \
  -e AI_API_KEY=your-provider-key \
  ghcr.io/darticusmaximus/home-pantry:latest
```

The runtime environment:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT` — your Appwrite endpoint, including the `/v1` suffix
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID` — the project ID from section 2
- `APPWRITE_API_KEY` — a `databases`-scoped API key; the image provisions the schema and starter data at start, then removes this key from the app's environment
- `AI_API_KEY` — optional, server-side only; the other `AI_*` variables from section 5 work the same way

Both `NEXT_PUBLIC_*` values are injected at container start by the image's entrypoint, so pointing the image at a different Appwrite needs no rebuild — just restart with new environment variables.

Or with a `docker-compose.yml`:

```yaml
services:
  pantry:
    image: ghcr.io/darticusmaximus/home-pantry:latest
    ports:
      - '3000:3000'
    environment:
      NEXT_PUBLIC_APPWRITE_ENDPOINT: https://your-appwrite.example/v1
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: your-project-id
      APPWRITE_API_KEY: your-databases-scoped-key
      AI_API_KEY: your-provider-key
    restart: unless-stopped
```

The HTTPS rules from section 7 apply unchanged: the app sets HSTS and the PWA's service worker needs a trustworthy origin. Put the container behind a reverse proxy that terminates TLS — reuse the same Caddy/nginx setup — and only expose the proxy.
