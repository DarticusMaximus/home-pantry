export const PANTRY_REACH_TIMEOUT_MS = 8000
export const CANNOT_REACH_PANTRY_COPY = "Can't reach the pantry."

export class PantryUnreachableError extends Error {
  constructor(message = CANNOT_REACH_PANTRY_COPY) {
    super(message)
    this.name = 'PantryUnreachableError'
  }
}

export function isPantryUnreachableError(error: unknown): boolean {
  return (
    error instanceof PantryUnreachableError ||
    (error instanceof Error && error.name === 'PantryUnreachableError')
  )
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = PANTRY_REACH_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PantryUnreachableError())
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
