import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function resolveBinary(name: string) {
  if (process.platform !== 'win32') return name
  if (name === 'pnpm') return 'pnpm.cmd'
  return name
}

function firstNonEmptyLine(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

function quoteForWindowsCmd(value: string) {
  if (value.length === 0) return '""'
  if (!/[\s"&()^%!]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

export function resolveCommandInvocation(command: string, args: string[]) {
  const resolved = resolveBinary(command)

  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    const comspec = process.env.ComSpec || 'cmd.exe'
    const line = [resolved, ...args].map((token) => quoteForWindowsCmd(String(token))).join(' ')
    return {
      file: comspec,
      args: ['/d', '/s', '/c', line],
      shell: false,
    } as const
  }

  return {
    file: resolved,
    args,
    shell: false,
  } as const
}

export function resolvePnpmInvocation(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const npmExecPath = String(env.npm_execpath ?? '').trim()
  const npmExecBase = path.basename(npmExecPath).toLowerCase()

  if (npmExecPath && npmExecBase.includes('pnpm')) {
    return {
      file: process.execPath,
      args: [npmExecPath, ...args],
      shell: false,
    } as const
  }

  return resolveCommandInvocation('pnpm', args)
}

export function probeCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: NodeJS.ProcessEnv
  },
) {
  const invocation = command === 'pnpm' ? resolvePnpmInvocation(args, options?.env) : resolveCommandInvocation(command, args)
  const result = spawnSync(invocation.file, invocation.args, {
    cwd: options?.cwd,
    env: options?.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: invocation.shell,
  })

  const stdout = String(result.stdout ?? '').trim()
  const stderr = String(result.stderr ?? '').trim()
  const status = typeof result.status === 'number' ? result.status : 1
  const error = result.error instanceof Error ? result.error : null

  return {
    ok: status === 0 && !error,
    status,
    stdout,
    stderr,
    error,
  }
}

export function ensureDockerEngineReady(options?: { cwd?: string; env?: NodeJS.ProcessEnv }) {
  const composeVersion = probeCommand('docker', ['compose', 'version'], options)
  if (!composeVersion.ok) {
    const detail = composeVersion.error?.message || firstNonEmptyLine(composeVersion.stderr) || 'docker compose command failed'
    throw new Error(`Docker Compose chưa sẵn sàng. Cài Docker Desktop/Compose plugin hoặc sửa PATH. ${detail}`)
  }

  const dockerServer = probeCommand('docker', ['version', '--format', '{{.Server.Version}}'], options)
  if (!dockerServer.ok) {
    const detail = dockerServer.error?.message || firstNonEmptyLine(dockerServer.stderr) || 'docker daemon unavailable'
    throw new Error(`Docker engine chưa chạy. Hãy bật Docker Desktop hoặc Docker daemon trước khi compose-up. ${detail}`)
  }
}

export async function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: NodeJS.ProcessEnv
    label?: string
  },
) {
  const invocation = command === 'pnpm' ? resolvePnpmInvocation(args, options?.env) : resolveCommandInvocation(command, args)
  const label = options?.label ?? [command, ...args].join(' ')
  console.log(`[exec] ${label}`)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(invocation.file, invocation.args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: 'inherit',
      shell: invocation.shell,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with exit code ${code}: ${label}`))
    })
  })
}

export async function runPnpmScript(scriptName: string, options?: { env?: NodeJS.ProcessEnv }) {
  await runCommand('pnpm', [scriptName], {
    cwd: process.cwd(),
    env: options?.env,
    label: `pnpm ${scriptName}`,
  })
}
