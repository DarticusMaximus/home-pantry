import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const nextConfigSource = readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8')

async function getProductionCsp(endpoint: string | undefined) {
  vi.stubEnv('NODE_ENV', 'production')

  if (endpoint) {
    vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', endpoint)
  } else {
    vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', undefined)
  }

  vi.resetModules()
  const { default: nextConfig } = await import('../next.config.mjs')

  if (!nextConfig.headers) {
    throw new Error('nextConfig.headers is not defined')
  }

  const headerRoutes = await nextConfig.headers()
  const globalHeaders = headerRoutes.find((route) => route.source === '/:path*')?.headers
  return new Map(globalHeaders?.map((header) => [header.key, header.value])).get(
    'Content-Security-Policy',
  )
}

function getCspDirective(csp: string | undefined, name: string) {
  return csp?.split('; ').find((directive) => directive.startsWith(name))
}

describe('next security headers config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('configures required security headers for all routes', async () => {
    const { default: nextConfig } = await import('../next.config.mjs')

    expect(typeof nextConfig.headers).toBe('function')

    if (!nextConfig.headers) {
      throw new Error('nextConfig.headers is not defined')
    }

    const headerRoutes = await nextConfig.headers()
    const globalHeaders = headerRoutes.find((route) => route.source === '/:path*')?.headers

    expect(globalHeaders).toBeDefined()

    const headerMap = new Map(globalHeaders?.map((header) => [header.key, header.value]))

    expect(headerMap.get('X-Frame-Options')).toBe('DENY')
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')

    const csp = headerMap.get('Content-Security-Policy')

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it.each([
    'production',
    'development',
  ] as const)('allows same-origin microphone and denies camera and geolocation in %s', async (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.resetModules()
    const { default: nextConfig } = await import('../next.config.mjs')

    if (!nextConfig.headers) {
      throw new Error('nextConfig.headers is not defined')
    }

    const headerRoutes = await nextConfig.headers()
    const globalHeaders = headerRoutes.find((route) => route.source === '/:path*')?.headers
    const headerMap = new Map(globalHeaders?.map((header) => [header.key, header.value]))

    expect(headerMap.get('Permissions-Policy')).toBe('microphone=(self), camera=(), geolocation=()')
  })

  it.each([
    'production',
    'development',
  ] as const)('sets experimental.serverActions.bodySizeLimit to 25mb in %s', async (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.resetModules()
    const { default: nextConfig } = await import('../next.config.mjs')

    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe('25mb')
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).not.toBe('8mb')
  })

  it('restricts production connections to self and the Appwrite endpoint origin', async () => {
    const csp = await getProductionCsp('https://fra.cloud.appwrite.io/v1')

    expect(getCspDirective(csp, 'connect-src')).toBe(
      "connect-src 'self' https://fra.cloud.appwrite.io",
    )
    expect(csp).not.toMatch(/(?:^|\s)https:(?=\s|;|$)/)
  })

  it('does not add a connection source when the Appwrite endpoint is absent or invalid', async () => {
    expect(getCspDirective(await getProductionCsp(undefined), 'connect-src')).toBe(
      "connect-src 'self'",
    )
    expect(getCspDirective(await getProductionCsp('not a URL'), 'connect-src')).toBe(
      "connect-src 'self'",
    )
  })
})

describe('next PWA Workbox contract', () => {
  it('keeps dest, register, skipWaiting, and disable-in-development', () => {
    expect(nextConfigSource).toMatch(/dest:\s*["']public["']/)
    expect(nextConfigSource).toContain('register: true')
    expect(nextConfigSource).toContain('skipWaiting: true')
    expect(nextConfigSource).toMatch(
      /disable:\s*process\.env\.NODE_ENV\s*===\s*["']development["']/,
    )
  })

  it('overrides default cross-origin NetworkFirst with NetworkOnly', () => {
    expect(nextConfigSource).toContain('extendDefaultRuntimeCaching: true')
    expect(nextConfigSource).toContain('NetworkOnly')
    expect(nextConfigSource).toMatch(/cacheName:\s*["']cross-origin["']/)
    expect(nextConfigSource).not.toMatch(
      /NetworkFirst[\s\S]{0,400}cacheName:\s*["']cross-origin["']/,
    )
    expect(nextConfigSource).not.toMatch(
      /cacheName:\s*["']cross-origin["'][\s\S]{0,400}NetworkFirst/,
    )
  })

  it('scopes NetworkOnly to the Appwrite origin, not every cross-origin GET', () => {
    expect(nextConfigSource).not.toMatch(
      /urlPattern:\s*\(\{\s*sameOrigin\s*\}\)\s*=>\s*!sameOrigin/,
    )
    expect(nextConfigSource).toMatch(/url\.origin\s*===\s*appwriteOrigin/)
  })
})
