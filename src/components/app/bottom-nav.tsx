'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { HomeIcon, SearchIcon, TrophyIcon } from './icons'

const items = [
  { href: '/', label: 'Accueil', icon: HomeIcon },
  { href: '/competitions', label: 'Compétitions', icon: TrophyIcon },
  { href: '/recherche', label: 'Recherche', icon: SearchIcon },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map((item) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            className={active ? 'bottom-nav-link is-active' : 'bottom-nav-link'}
            href={item.href}
            aria-current={active ? 'page' : undefined}
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
