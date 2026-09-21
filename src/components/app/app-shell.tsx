import Link from 'next/link'
import type { ReactNode } from 'react'

import { BottomNav } from './bottom-nav'
import { SearchIcon } from './icons'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Courrier Sportif — Accueil">
          <span className="brand-mark" aria-hidden="true">
            CS
          </span>
          <span className="brand-copy">
            <strong>Courrier Sportif</strong>
            <small>Football camerounais</small>
          </span>
        </Link>
        <Link className="icon-button" href="/recherche" aria-label="Rechercher">
          <SearchIcon />
        </Link>
      </header>
      <main id="main-content" className="app-content">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
