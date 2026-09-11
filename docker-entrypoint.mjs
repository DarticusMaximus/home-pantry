import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const PLACEHOLDER_ENDPOINT = 'https://appwrite.placeholder.invalid/v1'
export const PLACEHOLDER_ORIGIN = 'https://appwrite.placeholder.invalid'
export const PLACEHOLDER_PROJECT_ID = 'placeholder-project-id'

export function buildReplacements(env) {
  const endpoint = env?.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const projectId = env?.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  if (!endpoint) {
    throw new Error('NEXT_PUBLIC_APPWRITE_ENDPOINT is required at container start')
  }
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_APPWRITE_PROJECT_ID is required at container start')
  }
  const origin = new URL(endpoint).origin
  return [
    [PLACEHOLDER_ENDPOINT, endpoint],
    [PLACEHOLDER_ORIGIN, origin],
    [PLACEHOLDER_PROJECT_ID, projectId],
  ]
}

export function rewriteFile(file, replacements) {
  if (!existsSync(file)) {
    return false
  }
  const original = readFileSync(file, 'utf8')
  let rewritten = original
  for (const [from, to] of replacements) {
    rewritten = rewritten.split(from).join(to)
  }
  if (rewritten === original) {
    return false
  }
  writeFileSync(file, rewritten, 'utf8')
  return true
}

function collectFiles(dir) {
  if (!existsSync(dir)) {
    return []
  }
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(full))
    } else if (entry.isFile()) {
      files.push(full)
    }
  }
  return files
}

function main() {
  let replacements
  try {
    replacements = buildReplacements(process.env)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const root = path.dirname(fileURLToPath(import.meta.url))
  const targets = [
    ...collectFiles(path.join(root, '.next', 'static')),
    ...collectFiles(path.join(root, '.next', 'server')),
    path.join(root, 'public', 'sw.js'),
    path.join(root, '.next', 'routes-manifest.json'),
    path.join(root, '.next', 'required-server-files.json'),
  ]

  let changed = 0
  for (const file of targets) {
    if (rewriteFile(file, replacements)) {
      changed += 1
    }
  }
  console.log(`Entrypoint rewrote ${changed} files`)

  const child = spawn('node', ['server.js'], { stdio: 'inherit', cwd: root })
  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })
  child.on('exit', (code) => {
    process.exit(code ?? 1)
  })
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsScript) {
  main()
}
