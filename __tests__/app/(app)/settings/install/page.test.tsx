import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    className?: string
    [key: string]: unknown
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/platform', () => ({
  detectPlatform: vi.fn(),
  isStandaloneDisplay: vi.fn(),
}))

import InstallPage from '@/app/(app)/settings/install/page'
import { detectPlatform, isStandaloneDisplay } from '@/lib/platform'

const mockDetectPlatform = vi.mocked(detectPlatform)
const mockIsStandaloneDisplay = vi.mocked(isStandaloneDisplay)

const PRE_MOUNT_INTRO =
  'Add Home Pantry to this phone from this address. A different address is a different app.'

function mountedIntro(host: string): string {
  return `Add Home Pantry to this phone from ${host}. A different address is a different app.`
}

function assertOriginOnlyMarkup(html: string) {
  expect(html.replace(/<!-- -->/g, '')).toContain(PRE_MOUNT_INTRO)
  expect(html).not.toContain('Tap the Share button in Safari.')
  expect(html).not.toContain('Tap the menu button (three dots) in Chrome.')
  expect(html).not.toContain('Add to Home Screen')
  expect(html).not.toContain('already on this phone')
}

describe('InstallPage', () => {
  beforeEach(() => {
    mockDetectPlatform.mockReturnValue('desktop')
    mockIsStandaloneDisplay.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders "Install Home Pantry" heading', () => {
    render(<InstallPage />)

    expect(screen.getByText('Install Home Pantry')).toBeInTheDocument()
  })

  it('renders back link to /settings', () => {
    render(<InstallPage />)

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/settings')
  })

  it('renders the address-neutral intro paragraph exactly before mount', () => {
    const html = renderToStaticMarkup(<InstallPage />).replace(/<!-- -->/g, '')

    const intro = html.match(/<p[^>]*>([^<]*)<\/p>/)
    expect(intro?.[1]).toBe(PRE_MOUNT_INTRO)
  })

  it('derives the intro address from window.location.host after mount', async () => {
    render(<InstallPage />)

    await waitFor(() => {
      expect(screen.getByText(mountedIntro(window.location.host))).toBeInTheDocument()
    })
  })

  it('pre-mount markup shows origin only when detectPlatform is ios', () => {
    mockDetectPlatform.mockReturnValue('ios')
    const html = renderToStaticMarkup(<InstallPage />)

    assertOriginOnlyMarkup(html)
  })

  it('pre-mount markup shows origin only when already standalone', () => {
    mockDetectPlatform.mockReturnValue('ios')
    mockIsStandaloneDisplay.mockReturnValue(true)
    const html = renderToStaticMarkup(<InstallPage />)

    assertOriginOnlyMarkup(html)
  })

  it('puts iOS card first and highlighted when detectPlatform returns ios', async () => {
    mockDetectPlatform.mockReturnValue('ios')
    render(<InstallPage />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('On iPhone or iPad')
    })
    expect(screen.getByRole('heading', { name: 'On Android' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'On Desktop' })).toBeInTheDocument()

    const iosCard = screen.getByText('On iPhone or iPad').closest('div[class*="rounded"]')
    expect(iosCard?.className).toContain('border-emerald-500')

    expect(screen.getByText('Tap the Share button in Safari.')).toBeInTheDocument()
    expect(screen.getByText('Scroll down and tap Add to Home Screen.')).toBeInTheDocument()
    expect(screen.getAllByText('Tap Add in the confirmation.').length).toBeGreaterThanOrEqual(1)
  })

  it('puts Android card first and highlighted when detectPlatform returns android', async () => {
    mockDetectPlatform.mockReturnValue('android')
    render(<InstallPage />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('On Android')
    })

    const androidCard = screen.getByText('On Android').closest('div[class*="rounded"]')
    expect(androidCard?.className).toContain('border-emerald-500')

    expect(screen.getByText('Tap the menu button (three dots) in Chrome.')).toBeInTheDocument()
    expect(screen.getByText('Tap Install app or Add to Home screen.')).toBeInTheDocument()
    expect(screen.getAllByText('Tap Add in the confirmation.').length).toBeGreaterThanOrEqual(1)
  })

  it('puts Desktop card first when detectPlatform returns desktop', async () => {
    render(<InstallPage />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('On Desktop')
    })
    expect(screen.getByText('On iPhone or iPad')).toBeInTheDocument()
    expect(screen.getByText('On Android')).toBeInTheDocument()
    expect(screen.getByText('On Desktop')).toBeInTheDocument()
  })

  it('highlights the detected platform card', async () => {
    mockDetectPlatform.mockReturnValue('ios')
    render(<InstallPage />)

    await waitFor(() => {
      const iosCard = screen.getByText('On iPhone or iPad').closest('div[class*="rounded"]')
      expect(iosCard?.className).toContain('border-emerald-500')
    })
  })

  it('renders ordered steps in instruction cards', async () => {
    render(<InstallPage />)

    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
    })
  })

  it('shows already-installed status and hides instruction cards when standalone', async () => {
    mockDetectPlatform.mockReturnValue('ios')
    mockIsStandaloneDisplay.mockReturnValue(true)
    render(<InstallPage />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        "Home Pantry is already on this phone's home screen.",
      )
    })

    expect(screen.getByText(mountedIntro(window.location.host))).toBeInTheDocument()
    expect(screen.queryByText('Tap the Share button in Safari.')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Tap the menu button (three dots) in Chrome.'),
    ).not.toBeInTheDocument()
  })
})
