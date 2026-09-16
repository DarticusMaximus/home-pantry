import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLACEHOLDER_ENDPOINT, PLACEHOLDER_PROJECT_ID } from '../docker-entrypoint.mjs'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

async function readRepoFile(name: string): Promise<string> {
  return readFile(path.join(repoRoot, '..', name), 'utf8')
}

function extractTopLevelBlock(source: string, key: string): string {
  const start = source.match(new RegExp(`^${key}:`, 'm'))
  if (!start || start.index === undefined) return ''
  const lines = source.slice(start.index + key.length + 1).split('\n')
  const block: string[] = []
  for (const line of lines.slice(1)) {
    if (line !== '' && !line.startsWith(' ')) break
    block.push(line)
  }
  return block.join('\n')
}

function extractMarkdownSection(source: string, heading: string): string {
  const start = source.indexOf(`\n${heading}\n`)
  expect(start, heading).toBeGreaterThan(-1)
  const after = source.slice(start + 1)
  const next = after.indexOf('\n## ')
  return next === -1 ? after : after.slice(0, next)
}

function extractJobBlock(source: string, job: string): string {
  const start = source.match(new RegExp(`^ {2}${job}:`, 'm'))
  if (!start || start.index === undefined) return ''
  const lines = source.slice(start.index).split('\n')
  const block: string[] = []
  for (const line of lines.slice(1)) {
    if (line !== '' && !line.startsWith('    ')) break
    block.push(line)
  }
  return block.join('\n')
}

function extractStepBlock(source: string, marker: string): string {
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const stepStart = source.lastIndexOf('\n      - name:', start)
  const rest = source.slice(stepStart === -1 ? start : stepStart)
  const next = rest.indexOf('\n      - name:', 1)
  return next === -1 ? rest : rest.slice(0, next)
}

const HOSTNAME_LIKE = /[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi
const RESERVED_HOST_TLDS = new Set(['example', 'test', 'invalid', 'localhost', 'local'])
const FILENAME_SUFFIXES = new Set([
  'md',
  'yml',
  'yaml',
  'json',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'txt',
  'lock',
])
const ALLOWED_HOST_SUFFIXES = [
  'example.com',
  'ghcr.io',
  'github.com',
  'localhost',
  'appwrite.io',
  'nextjs.org',
  'pnpm.io',
]

function isAllowedHost(host: string): boolean {
  const suffix = host.split('.').pop()
  if (suffix !== undefined && (RESERVED_HOST_TLDS.has(suffix) || FILENAME_SUFFIXES.has(suffix)))
    return true
  return ALLOWED_HOST_SUFFIXES.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

function findOffendingHosts(text: string): string[] {
  const scrubbed = text.replace(/\$\{\{[^}]*\}\}/g, ' ')
  const hosts = scrubbed.match(HOSTNAME_LIKE) ?? []
  return [...new Set(hosts.map((host) => host.toLowerCase()))].filter(
    (host) => !isAllowedHost(host),
  )
}

describe('release assets', () => {
  describe('Dockerfile', () => {
    it('uses node:22 for deps, builder, and runner stages', async () => {
      const dockerfile = await readRepoFile('Dockerfile')

      expect(dockerfile).toContain('FROM node:22-alpine AS deps')
      expect(dockerfile).toContain('FROM node:22-alpine AS builder')
      expect(dockerfile).toContain('FROM node:22-alpine AS runner')
    })

    it('copies manifest files before a frozen install with dev deps', async () => {
      const dockerfile = await readRepoFile('Dockerfile')
      const install = dockerfile.indexOf('pnpm install --frozen-lockfile')

      expect(install).toBeGreaterThan(-1)
      for (const manifest of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
        expect(dockerfile.indexOf(manifest)).toBeLessThan(install)
      }
      expect(dockerfile).not.toContain('--prod')
    })

    it('bakes the entrypoint placeholder constants into the build env', async () => {
      const dockerfile = await readRepoFile('Dockerfile')

      expect(dockerfile).toContain(`NEXT_PUBLIC_APPWRITE_ENDPOINT=${PLACEHOLDER_ENDPOINT}`)
      expect(dockerfile).toContain(`NEXT_PUBLIC_APPWRITE_PROJECT_ID=${PLACEHOLDER_PROJECT_ID}`)
      expect(dockerfile).not.toContain('NEXT_PUBLIC_APPWRITE_ORIGIN')
    })

    it('ships standalone output, static chunks, and builder-built public files', async () => {
      const dockerfile = await readRepoFile('Dockerfile')

      expect(dockerfile).toContain('.next/standalone')
      expect(dockerfile).toContain('.next/static')
      expect(dockerfile).toMatch(/--from=builder[^\n]*\/app\/public/)
    })

    it('runs as node on port 3000 through the entrypoint script', async () => {
      const dockerfile = await readRepoFile('Dockerfile')

      expect(dockerfile).toContain('USER node')
      expect(dockerfile).toContain('EXPOSE 3000')
      expect(dockerfile).toContain('ENTRYPOINT ["node", "docker-entrypoint.mjs"]')
    })

    it('bundles provision.mjs from scripts/provision.ts after the Next build', async () => {
      const dockerfile = await readRepoFile('Dockerfile')
      const build = dockerfile.indexOf('pnpm build')
      const bundle = dockerfile.indexOf('esbuild')

      expect(build).toBeGreaterThan(-1)
      expect(bundle).toBeGreaterThan(build)
      expect(dockerfile).toContain('scripts/provision.ts')
      expect(dockerfile).toContain('--bundle')
      expect(dockerfile).toContain('--platform=node')
      expect(dockerfile).toContain('--format=esm')
      expect(dockerfile).toMatch(/esbuild[^\n]*provision\.mjs/)
    })

    it('copies provision.mjs from the builder beside the entrypoint', async () => {
      const dockerfile = await readRepoFile('Dockerfile')

      expect(dockerfile).toContain(
        'COPY --from=builder --chown=node:node /app/provision.mjs ./provision.mjs',
      )
      expect(dockerfile).toContain(
        'COPY --chown=node:node docker-entrypoint.mjs ./docker-entrypoint.mjs',
      )
    })
  })

  describe('.dockerignore', () => {
    it('keeps private and generated paths out of the build context', async () => {
      const dockerignore = await readRepoFile('.dockerignore')

      for (const excluded of [
        '.git',
        'node_modules',
        '.next',
        '.ssc',
        'AGENTS.md',
        'opencode.json',
        '.env',
        'scripts/sweep-markers.local.txt',
        '*.bundle',
        '.codegraph',
        '.opencode',
        '__tests__',
        'e2e',
        'coverage',
        'test-results',
        'playwright-report',
      ]) {
        expect(dockerignore).toContain(excluded)
      }
    })
  })

  describe('next.config.mjs', () => {
    it('enables standalone server output', async () => {
      const nextConfig = await readRepoFile('next.config.mjs')

      expect(nextConfig).toMatch(/output:\s*['"]standalone['"]/)
    })
  })

  describe('.github/workflows/release.yml', () => {
    it('exists and triggers only on version tag pushes', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const trigger = extractTopLevelBlock(workflow, 'on')

      expect(trigger).toContain('tags:')
      expect(trigger).toContain("'v*'")
      expect(trigger).not.toContain('branches:')
      expect(trigger).not.toContain('pull_request')
      expect(trigger).not.toContain('workflow_dispatch')
    })

    it('grants only contents and packages write', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const permissions = extractTopLevelBlock(workflow, 'permissions')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line !== '')

      expect(permissions).toEqual(['  contents: write', '  packages: write'])
    })

    it('runs one release job on ubuntu-latest', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')

      expect(workflow).toContain('runs-on: ubuntu-latest')
    })

    it('logs in to ghcr.io as the actor with GITHUB_TOKEN', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const login = extractStepBlock(workflow, 'docker/login-action@v4')

      expect(login).toContain('registry: ghcr.io')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
      expect(login).toContain('username: ${{ github.actor }}')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
      expect(login).toContain('password: ${{ secrets.GITHUB_TOKEN }}')
    })

    it('derives image tags through docker/metadata-action', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const meta = extractStepBlock(workflow, 'docker/metadata-action@v6')

      expect(meta).toContain('id: meta')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
      expect(meta).toContain('images: ghcr.io/${{ github.repository }}')
      expect(meta).toContain('type=semver,pattern={{version}}')
      expect(meta).toContain('type=raw,value=latest')
    })

    it('builds and pushes amd64-only with gha cache and meta outputs', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const build = extractStepBlock(workflow, 'docker/build-push-action@v7')

      expect(build).toContain('context: .')
      expect(build).toContain('platforms: linux/amd64')
      expect(build.toLowerCase()).not.toContain('arm')
      expect(build).toContain('push: true')
      expect(build).toContain('cache-from: type=gha')
      expect(build).toContain('cache-to: type=gha,mode=max')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
      expect(build).toContain('tags: ${{ steps.meta.outputs.tags }}')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
      expect(build).toContain('labels: ${{ steps.meta.outputs.labels }}')
    })

    it('creates a GitHub release via gh with an interpolated image tag', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const release = extractStepBlock(workflow, 'gh release create')

      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, not a JS template
      expect(release).toContain('GH_TOKEN: ${{ github.token }}')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: shell parameter expansion, not a JS template
      expect(release).toContain('IMAGE_TAG="${GITHUB_REF_NAME#v}"')
      expect(release).toContain('gh release create "$GITHUB_REF_NAME"')
      // biome-ignore lint/suspicious/noTemplateCurlyInString: shell parameter expansion, not a JS template
      expect(release).toContain('ghcr.io/darticusmaximus/home-pantry:${IMAGE_TAG}')
      expect(release).toContain('See docs/self-hosting.md for the full runbook.')
    })

    it('states container self-provisioning and optional AI key in the release notes', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const release = extractStepBlock(workflow, 'gh release create')

      expect(release).toContain('APPWRITE_API_KEY')
      expect(release).toContain('databases-scoped API key')
      expect(release).toContain('provisions the database')
      expect(release).toContain('removes the key')
      expect(release).toContain('no repo checkout needed')
      expect(release).toContain('AI_API_KEY is optional')
      expect(release).toContain('docs/self-hosting.md')
    })

    it('references no secret other than GITHUB_TOKEN', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const secretRefs = workflow.match(/secrets\.[A-Za-z_]+/g) ?? []

      expect(secretRefs).toEqual(['secrets.GITHUB_TOKEN'])
    })

    it('runs a verify job with the full check floor before release', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const verify = extractJobBlock(workflow, 'verify')

      expect(verify).toContain('pnpm install --frozen-lockfile')
      expect(verify).toContain('pnpm typecheck')
      expect(verify).toContain('pnpm lint')
      expect(verify).toContain('pnpm test')
      expect(verify).toContain('pnpm sweep')
    })

    it('makes the release job depend on verify', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')
      const release = extractJobBlock(workflow, 'release')

      expect(release).toContain('needs: verify')
    })

    it('uses spaces only for indentation', async () => {
      const workflow = await readRepoFile('.github/workflows/release.yml')

      expect(workflow).not.toContain('\t')
    })
  })

  describe('.github/workflows/ci.yml', () => {
    it('exists and triggers on push and pull_request', async () => {
      const workflow = await readRepoFile('.github/workflows/ci.yml')
      const trigger = extractTopLevelBlock(workflow, 'on')

      expect(trigger).toContain('push:')
      expect(trigger).toContain('pull_request:')
    })

    it('installs frozen and runs typecheck, lint, tests, and the sweep', async () => {
      const workflow = await readRepoFile('.github/workflows/ci.yml')

      expect(workflow).toContain('pnpm install --frozen-lockfile')
      expect(workflow).toContain('pnpm typecheck')
      expect(workflow).toContain('pnpm lint')
      expect(workflow).toContain('pnpm test')
      expect(workflow).toContain('pnpm sweep')
    })

    it('keeps Playwright e2e out of CI', async () => {
      const workflow = await readRepoFile('.github/workflows/ci.yml')

      expect(workflow).not.toContain('playwright')
      expect(workflow).not.toContain('test:e2e')
    })

    it('uses spaces only for indentation', async () => {
      const workflow = await readRepoFile('.github/workflows/ci.yml')

      expect(workflow).not.toContain('\t')
    })
  })

  describe('package.json scripts', () => {
    it('exposes the public-tree sweep as pnpm sweep', async () => {
      const pkg = JSON.parse(await readRepoFile('package.json'))

      expect(pkg.scripts.sweep).toBe('tsx scripts/sweep-public-tree.ts')
    })
  })

  describe('release docs', () => {
    it('README ships a Docker run section anchored to its heading', async () => {
      const readme = await readRepoFile('README.md')
      const section = extractMarkdownSection(readme, '## Run the Docker image')

      expect(section).toContain('ghcr.io/darticusmaximus/home-pantry')
      expect(section).toContain('docker run')
      expect(section).toContain('NEXT_PUBLIC_APPWRITE_ENDPOINT')
      expect(section).toContain('NEXT_PUBLIC_APPWRITE_PROJECT_ID')
      expect(section).toContain('AI_API_KEY')
      expect(section).toContain('latest')
      expect(section).toContain('docs/self-hosting.md')
    })

    it('self-hosting guide covers the Docker path with runtime env and compose', async () => {
      const guide = await readRepoFile('docs/self-hosting.md')
      const section = extractMarkdownSection(guide, '## 8. Run the Docker image')

      expect(section).toContain('ghcr.io/darticusmaximus/home-pantry')
      expect(section).toContain('docker run')
      expect(section).toContain('NEXT_PUBLIC_APPWRITE_ENDPOINT')
      expect(section).toContain('NEXT_PUBLIC_APPWRITE_PROJECT_ID')
      expect(section).toContain('AI_API_KEY')
      expect(section).toContain('docker-compose.yml')
      expect(section).toContain('container start')
      expect(section).toContain('no rebuild')
      expect(section).toContain('1.0.0')
      expect(section).toContain('latest')
      expect(section).toContain('HTTPS')
    })
  })

  describe('hostname hygiene', () => {
    it('passes placeholder and allowlisted hosts while flagging real-looking ones', () => {
      expect(isAllowedHost('your-appwrite.example')).toBe(true)
      expect(isAllowedHost('pantry.example.com')).toBe(true)
      expect(isAllowedHost('fra.cloud.appwrite.io')).toBe(true)
      expect(isAllowedHost('ghcr.io')).toBe(true)
      expect(isAllowedHost('github.com')).toBe(true)
      expect(isAllowedHost('localhost')).toBe(true)
      expect(isAllowedHost('env.local')).toBe(true)
      expect(isAllowedHost('self-hosting.md')).toBe(true)
      expect(isAllowedHost('x.notplaceholder.real')).toBe(false)
      expect(isAllowedHost('smtp.notplaceholder.dev')).toBe(false)
      expect(findOffendingHosts('deploy to x.notplaceholder.real now')).toEqual([
        'x.notplaceholder.real',
      ])
      expect(
        findOffendingHosts('pull ${{ steps.meta.outputs.tags }} then push to ghcr.io'),
      ).toEqual([])
    })

    it('ships only placeholder or allowlisted hostnames across release assets', async () => {
      for (const file of ['.github/workflows/release.yml', 'README.md', 'docs/self-hosting.md']) {
        const offenders = findOffendingHosts(await readRepoFile(file))

        expect(offenders, `${file}: ${offenders.join(', ')}`).toEqual([])
      }
    })
  })
})
