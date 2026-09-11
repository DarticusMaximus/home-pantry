import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from '@/components/layout/bottom-nav'

const { mockUsePathname, mockPush, searchMode } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockPush: vi.fn(),
  searchMode: {
    isSearching: false,
    setIsSearching: vi.fn(),
    registerClearFilters: vi.fn(),
    openSearch: vi.fn(),
    exitSearch: vi.fn(),
    focusField: false,
    clearFocusField: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    onClick,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
    'aria-label'?: string
  }) => (
    <a href={href} className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

vi.mock('@/contexts/search-mode-context', () => ({
  useSearchMode: () => searchMode,
}))

describe('BottomNav', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    searchMode.isSearching = false
  })

  it('renders all navigation items', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
  })

  it('renders the three tab links and no extra Add', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toEqual(['/', '/ai', '/settings'])
    expect(hrefs).not.toContain('/items/add')
    expect(screen.getByText('Add').closest('a')).toHaveAttribute('href', '/ai')
  })

  it('applies active style to Add on /ai', () => {
    mockUsePathname.mockReturnValue('/ai')

    render(<BottomNav />)

    const addLink = screen.getByText('Add').closest('a')
    expect(addLink).toHaveClass('text-emerald-600')
  })

  it('applies active style to Add on /items/add', () => {
    mockUsePathname.mockReturnValue('/items/add')

    render(<BottomNav />)

    const addLink = screen.getByText('Add').closest('a')
    expect(addLink).toHaveClass('text-emerald-600')
  })

  it('applies active style to settings on sub-routes', () => {
    mockUsePathname.mockReturnValue('/settings/locations')

    render(<BottomNav />)

    const settingsLink = screen.getByText('Settings').closest('a')
    expect(settingsLink).toHaveClass('text-emerald-600')
  })

  it('applies inactive style to Add on home', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    const addLink = screen.getByText('Add').closest('a')
    expect(addLink).toHaveClass('text-gray-500')
  })

  it('applies active style to home on exact match only', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toHaveClass('text-emerald-600')
  })

  it('renders search button', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    expect(screen.getByLabelText('Search items')).toBeInTheDocument()
  })

  it('renders as a fixed nav element', () => {
    mockUsePathname.mockReturnValue('/')

    const { container } = render(<BottomNav />)

    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('fixed', 'bottom-0', 'pb-safe')
  })

  it('keeps kitchen touch targets on search and tab links', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    expect(screen.getByLabelText('Search items')).toHaveClass('min-h-[44px]')
    expect(screen.getByText('Home').closest('a')).toHaveClass('h-16', 'w-16')
    expect(screen.getByText('Add').closest('a')).toHaveClass('h-16', 'w-16')
    expect(screen.getByText('Settings').closest('a')).toHaveClass('h-16', 'w-16')
  })

  it('hides on the AI review screen', () => {
    mockUsePathname.mockReturnValue('/ai/review')

    const { container } = render(<BottomNav />)

    expect(container.querySelector('nav')).not.toBeInTheDocument()
  })

  it('closes search on Home without navigating', () => {
    mockUsePathname.mockReturnValue('/')
    searchMode.isSearching = true

    render(<BottomNav />)

    fireEvent.click(screen.getByLabelText('Close search'))

    expect(searchMode.exitSearch).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('opens focused search on Home without navigating', () => {
    mockUsePathname.mockReturnValue('/')

    render(<BottomNav />)

    fireEvent.click(screen.getByLabelText('Search items'))

    expect(searchMode.openSearch).toHaveBeenCalledWith({ focusField: true })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('opens focused search from Add and navigates home', () => {
    mockUsePathname.mockReturnValue('/ai')

    render(<BottomNav />)

    fireEvent.click(screen.getByLabelText('Search items'))

    expect(searchMode.openSearch).toHaveBeenCalledWith({ focusField: true })
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('treats item pages as Search, not Close', () => {
    mockUsePathname.mockReturnValue('/items/abc/edit')
    searchMode.isSearching = true

    render(<BottomNav />)

    expect(screen.getByLabelText('Search items')).toBeInTheDocument()
    expect(screen.queryByLabelText('Close search')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Search items'))

    expect(searchMode.openSearch).toHaveBeenCalledWith({ focusField: true })
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('exits search from Home, Add, and Settings', () => {
    mockUsePathname.mockReturnValue('/')
    searchMode.isSearching = true

    render(<BottomNav />)

    fireEvent.click(screen.getByText('Home').closest('a') as HTMLAnchorElement)
    fireEvent.click(screen.getByText('Add').closest('a') as HTMLAnchorElement)
    fireEvent.click(screen.getByText('Settings').closest('a') as HTMLAnchorElement)

    expect(searchMode.exitSearch).toHaveBeenCalledTimes(3)

    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Add').closest('a')).toHaveAttribute('href', '/ai')
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
  })
})
