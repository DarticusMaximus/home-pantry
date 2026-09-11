import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const TOOLCHAIN_FLOOR = {
  packageManagerPrefix: 'pnpm@11',
  packageManagerPattern: /^pnpm@11(\.|$)/,
  scripts: {
    typecheck: 'tsc --noEmit',
    lint: 'biome check .',
    test: 'vitest run',
    build: 'next build',
  },
}

type PackageJsonFloor = {
  packageManager: string
  scripts: Record<string, string>
}

describe('toolchain floor', () => {
  it('package.json scripts match the recorded floor bodies', async () => {
    const { default: pkg } = (await import('../package.json')) as {
      default: PackageJsonFloor
    }

    for (const [name, command] of Object.entries(TOOLCHAIN_FLOOR.scripts)) {
      expect(pkg.scripts[name], `script ${name}`).toBe(command)
    }
  })

  it('packageManager is pinned to the pnpm 11 branch', async () => {
    const { default: pkg } = (await import('../package.json')) as {
      default: PackageJsonFloor
    }

    expect(pkg.packageManager).toMatch(TOOLCHAIN_FLOOR.packageManagerPattern)
  })

  it('packageManagerPattern accepts pnpm 11 branch pins and rejects other families', () => {
    const { packageManagerPattern } = TOOLCHAIN_FLOOR

    expect(packageManagerPattern.test('pnpm@11')).toBe(true)
    expect(packageManagerPattern.test('pnpm@11.13.0')).toBe(true)
    expect(packageManagerPattern.test('pnpm@11.24.0')).toBe(true)

    expect(packageManagerPattern.test('pnpm@9.0.0')).toBe(false)
    expect(packageManagerPattern.test('pnpm@12.0.0')).toBe(false)
    expect(packageManagerPattern.test('pnpm@110.0.0')).toBe(false)
    expect(packageManagerPattern.test('yarn@1.22.0')).toBe(false)
    expect(packageManagerPattern.test('npm@10')).toBe(false)
  })

  it('records the floor in .ssc/baseline/toolchain.md', () => {
    const markdown = readFileSync(path.join(process.cwd(), '.ssc/baseline/toolchain.md'), 'utf8')

    expect(markdown).toContain(TOOLCHAIN_FLOOR.packageManagerPrefix)
    for (const command of Object.values(TOOLCHAIN_FLOOR.scripts)) {
      expect(markdown).toContain(command)
    }
  })
})
