export type InUseResource = 'location' | 'category'

export interface InUseCounts {
  itemCount: number
  templateCount: number
}

export class InUseError extends Error {
  readonly resource: InUseResource
  readonly itemCount: number
  readonly templateCount: number

  constructor(args: { resource: InUseResource } & InUseCounts) {
    super(`${args.resource} is in use`)
    this.name = 'InUseError'
    this.resource = args.resource
    this.itemCount = args.itemCount
    this.templateCount = args.templateCount
  }
}
