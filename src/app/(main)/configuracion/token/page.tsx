'use client'

import { useState, useEffect } from 'react'

interface TokenInfo {
  valid: boolean
  daysLeft: number | null
  expiresAt: string | null
  scopes: string[]
  type: string
  error?: string
}

export default function TokenPage() {
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; token?: string; daysLeft?: number; instructions?: string; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchInfo = async () => {
    setLoadingInfo(true)
    try {
      const res = await fetch('/api/meta/token')
      const data = await res.json()
      setInfo(data)
    } finally {
      setLoadingInfo(false)
    }
  }

  useEffect(() => { fetchInfo() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setResult(null)
    try {
      const res = await fetch('/api/meta/token', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      if (data.success) fetchInfo()
    } finally {
      setRefreshing(false)
    }
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusColor = !info
    ? 'gray'
    : !info.valid
    ? 'red'
    : (info.daysLeft ?? 99) <= 10
    ? 'yellow'
    : 'green'

  const colorMap = {
    gray: { bg: 'bg-gray-900/20', border: 'border-gray-700', text: 'text-gray-400', dot: 'bg-gray-500' },
    red: { bg: 'bg-red-900/20', border: 'border-red-500/40', text: 'text-red-300', dot: 'bg-red-500' },
    yellow: { bg: 'bg-yellow-900/20', border: 'border-yellow-500/40', text: 'text-yellow-300', dot: 'bg-yellow-500' },
    green: { bg: 'bg-green-900/20', border: 'border-green-500/40', text: 'text-green-300', dot: 'bg-green-500' },
  }
  const colors = colorMap[statusColor]

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Token Meta Ads</h1>
        <p className="text-gray-400 text-sm mt-1">
          Gestiona el token de acceso a la API de Meta Ads. Los tokens de larga duración duran 60 días.
        </p>
      </div>

      {/* Estado actual */}
      <div className={`${colors.bg} border ${colors.border} rounded-xl p-5 mb-6`}>
        <div className="flex items-center gap-3 mb-3">
          <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
          <h2 className={`font-semibold ${colors.text}`}>
            {loadingInfo
              ? 'Verificando token...'
              : !info
              ? 'No se pudo verificar'
              : !info.valid
              ? 'Token inválido o expirado'
              : (info.daysLeft ?? 99) <= 10
              ? `Token expira en ${info.daysLeft} días`
              : `Token válido · ${info.daysLeft ?? '∞'} días restantes`}
          </h2>
        </div>
        {info && !loadingInfo && (
          <div className="space-y-1 text-sm text-gray-400">
            {info.expiresAt && (
              <p>Expira: {new Date(info.expiresAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
            )}
            {info.type && <p>Tipo: <span className="text-gray-300">{info.type}</span></p>}
            {info.scopes.length > 0 && (
              <p>Permisos: <span className="text-gray-300">{info.scopes.join(', ')}</span></p>
            )}
            {info.error && <p className="text-red-400">{info.error}</p>}
          </div>
        )}
      </div>

      {/* Instrucciones para obtener token */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-white font-semibold mb-3">Cómo renovar el token</h3>
        <ol className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold flex-shrink-0">1.</span>
            <span>
              Ve a{' '}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Meta Graph API Explorer
              </a>{' '}
              y genera un token de usuario con permisos: <code className="bg-gray-800 px-1 rounded text-xs">ads_read</code>, <code className="bg-gray-800 px-1 rounded text-xs">ads_management</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold flex-shrink-0">2.</span>
            <span>
              Configura <code className="bg-gray-800 px-1 rounded text-xs">META_APP_ID</code> y{' '}
              <code className="bg-gray-800 px-1 rounded text-xs">META_APP_SECRET</code> en las variables de entorno de Vercel
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold flex-shrink-0">3.</span>
            <span>
              Actualiza <code className="bg-gray-800 px-1 rounded text-xs">META_ACCESS_TOKEN</code> con el nuevo token corto y haz clic en{' '}
              <strong className="text-white">&quot;Renovar a 60 días&quot;</strong>
            </span>
          </li>
        </ol>
      </div>

      {/* Botón de renovación */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors mb-6"
      >
        {refreshing ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : '🔄'}
        {refreshing ? 'Renovando...' : 'Renovar a Long-Lived Token (60 días)'}
      </button>

      {/* Resultado */}
      {result && (
        <div className={`border rounded-xl p-5 ${result.success ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
          {result.success ? (
            <>
              <p className="text-green-300 font-semibold mb-2">
                ✅ Token renovado · {result.daysLeft} días de validez
              </p>
              {result.token && (
                <div className="bg-gray-900 rounded-lg p-3 mb-3">
                  <p className="text-gray-500 text-xs mb-1">Nuevo token:</p>
                  <p className="text-gray-300 text-xs break-all font-mono">{result.token.slice(0, 40)}…</p>
                </div>
              )}
              <div className="flex gap-2">
                {result.token && (
                  <button
                    onClick={() => copyToken(result.token!)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    {copied ? '✓ Copiado' : 'Copiar token completo'}
                  </button>
                )}
                <a
                  href="https://vercel.com/iaibaronz-2361s-projects/icse-dashboard/settings/environment-variables"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs rounded-lg transition-colors"
                >
                  Abrir Vercel →
                </a>
              </div>
              {result.instructions && (
                <p className="text-gray-500 text-xs mt-3 whitespace-pre-line">{result.instructions}</p>
              )}
            </>
          ) : (
            <p className="text-red-300 text-sm">{result.error}</p>
          )}
        </div>
      )}

      {/* Info adicional */}
      <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-gray-500 text-xs">
          <strong className="text-gray-400">💡 Tip:</strong> Para tokens que nunca expiren, usa un{' '}
          <a
            href="https://developers.facebook.com/docs/marketing-api/system-users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            System User token
          </a>{' '}
          desde el Business Manager de Meta. No requieren renovación.
        </p>
      </div>
    </div>
  )
}
