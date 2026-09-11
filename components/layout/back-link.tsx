import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Back"
      className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-gray-100"
    >
      <ArrowLeft className="h-5 w-5 text-gray-600" aria-hidden="true" />
    </Link>
  )
}
