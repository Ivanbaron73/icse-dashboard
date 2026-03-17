'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
    || pathname === href
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  )
}

interface TokenStatus {
  valid: boolean
  daysLeft: number | null
  expiresAt: string | null
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)

  useEffect(() => {
    fetch('/api/meta/token')
      .then((r) => r.json())
      .then((d) => setTokenStatus({ valid: d.valid, daysLeft: d.daysLeft, expiresAt: d.expiresAt }))
      .catch(() => null)
  }, [])

  const tokenWarning = tokenStatus && (!tokenStatus.valid || (tokenStatus.daysLeft !== null && tokenStatus.daysLeft <= 10))

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">I</div>
            <div>
              <span className="text-white font-bold text-base leading-none block">ICSE</span>
              <span className="text-gray-500 text-[10px] leading-tight block">Dashboard Marketing</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-4 py-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Meta Ads</p>
          <NavItem href="/dashboard" label="Panel General" icon="📊" />
          <NavItem href="/dashboard/campana" label="Por Campaña" icon="🎯" />
          <p className="px-4 py-1 mt-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Reportes</p>
          <NavItem href="/reportes" label="Reportes PDF" icon="📄" />
          <p className="px-4 py-1 mt-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Sistema</p>
          <NavItem href="/configuracion/workspace" label="Clínicas" icon="🏥" />
          <NavItem href="/configuracion/token" label="Token Meta" icon="🔑" />
          <NavItem href="/configuracion/facturacion" label="Facturación" icon="💳" />
        </nav>

        {/* Token warning */}
        {tokenWarning && (
          <div className="mx-3 mb-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-300 text-xs font-semibold">
              {tokenStatus?.valid === false ? '⚠ Token Meta expirado' : `⚠ Token expira en ${tokenStatus?.daysLeft} días`}
            </p>
            <Link
              href="/configuracion/token"
              className="text-yellow-400 hover:text-yellow-300 text-xs underline mt-0.5 block"
            >
              Renovar token →
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          <p className="text-gray-600 text-[10px]">Actualiza 8am · 6pm</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${tokenStatus?.valid === false ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
            <span className={`text-xs ${tokenStatus?.valid === false ? 'text-red-400' : 'text-green-400'}`}>
              {tokenStatus?.valid === false ? 'Token expirado' : 'Conectado'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
