# Home Pantry

Home Pantry is a household pantry PWA: a single shared inventory of the food and supplies your household actually has on hand. One deployment is one pantry — everyone with an account sees and edits the same data.

- One shared pantry per deployment — no per-user data silos
- Storage locations (fridge, freezer, cupboard…) and categories
- Expiry dates so nothing quietly goes bad unnoticed
- Item templates act as restock memory: recurring buys become one tap to re-add
- Add by text, photo, or voice — AI drafts the entries, a human reviews and confirms before anything is saved
- "Gone" means deleted: removing an item really removes it

## Stack

- [Next.js 15](https://nextjs.org/) (App Router) with React 19
- [Appwrite](https://appwrite.io/) for auth, database, and storage
- Tailwind CSS
- pnpm

## Quick start

```bash
pnpm install
cp .env.example .env.local
```

Fill in the Appwrite variables in `.env.local` (see the reference below), then create the database schema and load sample data:

```bash
pnpm setup
pnpm seed
pnpm dev
```

Open http://localhost:3000 and create your first account. For production serving, HTTPS, and PWA install, see [docs/self-hosting.md](docs/self-hosting.md).

## Run the Docker image

Every tagged release publishes a prebuilt image to `ghcr.io/darticusmaximus/home-pantry`, with both `1.0.0`-style version tags and `latest`. Create an Appwrite project and a databases-scoped API key, then pass `APPWRITE_API_KEY` to the container at start — the image provisions the database and starter data itself, then removes the key from the app's environment; no checkout is needed.

```bash
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite.example/v1 \
  -e NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id \
  -e APPWRITE_API_KEY=your-databases-scoped-key \
  -e AI_API_KEY=your-provider-key \
  ghcr.io/darticusmaximus/home-pantry:latest
```

`AI_API_KEY` is optional — without it, AI parsing is off and the rest of the app works. The Appwrite values are injected at container start, so no rebuild is needed.

Provisioning is create-if-missing and never wipes existing data: restarting against a provisioned database duplicates nothing. If provisioning fails, the container exits immediately (fail-fast). A Docker restart policy such as `unless-stopped` will retry that failed start — fix the key or Appwrite reachability rather than assuming the app is up.

The checkout path (`pnpm setup` / `pnpm seed`) remains available as an alternative; see [docs/self-hosting.md](docs/self-hosting.md) §2–3 for the full runbook, including docker-compose.

## Environment variables

Copy `.env.example` to `.env.local` and replace the placeholders. Never commit a real API key.

Appwrite (required):

- `NEXT_PUBLIC_APPWRITE_ENDPOINT` — your Appwrite endpoint, e.g. `https://fra.cloud.appwrite.io/v1`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID` — the project ID
- `APPWRITE_API_KEY` — a `databases`-scoped API key for `pnpm setup` / `pnpm seed` / `pnpm provision` (which load `.env.local`); it also doubles as the container provisioning key

AI, optional (any OpenAI-compatible provider):

- `AI_API_KEY`
- `AI_MODEL` — chat + vision model for text and photo parsing
- `AI_BASE_URL` — defaults to OpenRouter's endpoint if unset
- `AI_TRANSCRIBE_MODEL` — speech-to-text model for voice input

OpenRouter fallback (used when the matching `AI_*` variable is unset):

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_TRANSCRIBE_MODEL`

AI is optional: without a key, text/photo/voice parsing is disabled and everything else works. The prompts themselves are documented in [docs/ai-prompts.md](docs/ai-prompts.md). AI calls run server-side only — provider keys are never exposed to the browser.

## Commands

```bash
pnpm dev         # start the dev server
pnpm build       # production build
pnpm start       # serve the production build
pnpm typecheck   # TypeScript check
pnpm lint        # Biome lint + format check
pnpm lint:fix    # Biome check with auto-fixes
pnpm format      # format with Biome
pnpm test        # unit tests (Vitest)
pnpm test:watch  # unit tests in watch mode
pnpm test:e2e    # end-to-end tests (Playwright)
pnpm setup       # create/verify the Appwrite schema
pnpm seed        # load sample data into Appwrite
```

## Setup safety

`pnpm setup` is create-if-missing and verify-only by default: it never deletes collections, and "Setup complete!" means the schema was created or already existed.

A wipe of the pantry collections requires `SETUP_WIPE=1` (or `--wipe`) **and** an interactive y/N confirmation (default no) that names the endpoint, project, and database it is about to wipe. If stdin is not a TTY, the wipe is refused outright unless you also set `SETUP_WIPE_CONFIRM=yes` after reviewing the target. After an acknowledged wipe, setup recreates the collections with signed-in-user CRUD permissions; run `pnpm seed` afterward if you want sample data back.

## Self-hosting

[docs/self-hosting.md](docs/self-hosting.md) covers prerequisites, Appwrite project setup, the shared-pantry trust model, optional AI provider configuration, wipe safety, and serving over HTTPS for PWA install.

## License

[MIT](LICENSE)
