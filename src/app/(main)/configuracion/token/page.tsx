'use client'

import { useState } from 'react'

export default function TokenPage() {
  const [newToken, setNewToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; daysLeft?: number; error?: string; token?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleExchange = async () => {
    if (!newToken.trim()) return
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch('/api/meta/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortLivedToken: newToken.trim() }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) setNewToken('')
    } finally {
      setSaving(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Renovar Token Meta</h1>
        <p className="text-gray-400 text-sm mt-1">
          Pega un token corto de Meta y lo convertimos en Long-Lived Token (60 días).
        </p>
      </div>

      {/* Paso 1 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Paso 1 · Obtén un token corto</p>
        <ol className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold">1.</span>
            <span>
              Ve a{' '}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline hover:text-blue-300"
              >
                developers.facebook.com/tools/explorer
              </a>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold">2.</span>
            <span>Selecciona la app <strong className="text-white">1609351390206399</strong> en el menú superior</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold">3.</span>
            <span>Agrega permisos: <code className="bg-gray-800 px-1 rounded text-xs">ads_read</code> y <code className="bg-gray-800 px-1 rounded text-xs">ads_management</code></span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold">4.</span>
            <span>Haz clic en <strong className="text-white">Generate Access Token</strong> y cópialo</span>
          </li>
        </ol>
      </div>

      {/* Paso 2 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Paso 2 · Pega el token corto aquí</p>
        <textarea
          value={newToken}
          onChange={(e) => setNewToken(e.target.value)}
          placeholder="EAARFx..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={handleExchange}
          disabled={saving || !newToken.trim()}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : '🔄'}
          {saving ? 'Convirtiendo...' : 'Convertir a Long-Lived Token (60 días)'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className={`border rounded-xl p-5 mb-5 ${result.success ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
          {result.success ? (
            <>
              <p className="text-green-300 font-semibold mb-3">
                Token renovado · válido por {result.daysLeft ?? 60} días
              </p>
              {result.token && (
                <div className="bg-gray-900 rounded-lg p-3 mb-3">
                  <p className="text-gray-500 text-xs mb-1 font-medium">Nuevo Long-Lived Token:</p>
                  <p className="text-gray-300 text-xs break-all font-mono leading-relaxed">{result.token}</p>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {result.token && (
                  <button
                    onClick={() => copy(result.token!)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    {copied ? '✓ Copiado' : 'Copiar token'}
                  </button>
                )}
                <a
                  href="https://vercel.com/iaibaronz-2361s-projects/icse-dashboard/settings/environment-variables"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs rounded-lg transition-colors"
                >
                  Abrir Vercel env vars →
                </a>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                El token fue actualizado en Vercel automáticamente. Haz un nuevo deploy para que tome efecto.
              </p>
            </>
          ) : (
            <p className="text-red-300 text-sm">{result.error}</p>
          )}
        </div>
      )}

      {/* Tip */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-gray-500 text-xs">
          <strong className="text-gray-400">Tip:</strong> Para no repetir esto cada 60 días, usa un{' '}
          <a
            href="https://developers.facebook.com/docs/marketing-api/system-users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            System User token
          </a>{' '}
          desde Business Manager — no expira nunca.
        </p>
      </div>
    </div>
  )
}
