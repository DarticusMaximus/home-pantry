export function zeroQuantityConfirmCopy(name: string): {
  title: string
  description: string
  confirmText: string
} {
  return {
    title: `Remove ${name}?`,
    description: `This will remove ${name} from the pantry. This cannot be undone.`,
    confirmText: 'Remove',
  }
}
