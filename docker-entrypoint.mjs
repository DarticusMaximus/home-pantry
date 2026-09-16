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

export function shouldProvision(env) {
  return Boolean(env?.APPWRITE_API_KEY)
}

export function buildChildEnv(env) {
  const child = { ...env }
  delete child.APPWRITE_API_KEY
  return child
}

function scrubSecret(message, secret) {
  if (typeof secret !== 'string' || secret.length === 0) {
    return message
  }
  return message.split(secret).join('[redacted]')
}

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return scrubSecret(message, process.env.APPWRITE_API_KEY)
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

export async function main({
  provision: runProvision,
  spawn: spawnChild = spawn,
  exit = (code) => {
    process.exit(code)
  },
  root = path.dirname(fileURLToPath(import.meta.url)),
} = {}) {
  let replacements
  try {
    replacements = buildReplacements(process.env)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    exit(1)
    return
  }

  if (shouldProvision(process.env)) {
    try {
      if (typeof runProvision === 'function') {
        await runProvision()
      } else {
        const module = await import(pathToFileURL(path.join(root, 'provision.mjs')).href)
        await module.provision()
      }
    } catch (error) {
      console.error(describeError(error))
      exit(1)
      return
    }
  }

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

  const child = spawnChild('node', ['server.js'], {
    stdio: 'inherit',
    cwd: root,
    env: buildChildEnv(process.env),
  })
  child.on('error', (error) => {
    console.error(error)
    exit(1)
  })
  child.on('exit', (code) => {
    exit(code ?? 1)
  })
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsScript) {
  main().catch((error) => {
    console.error(describeError(error))
    process.exit(1)
  })
}
