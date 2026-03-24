'use client'

import { useState } from 'react'

type Result = { success: boolean; daysLeft?: number | null; permanent?: boolean; vercelUpdated?: boolean; error?: string; token?: string }

export default function TokenPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  const save = async (direct: boolean) => {
    if (!token.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const body = direct
        ? { direct: true, token: token.trim() }
        : { shortLivedToken: token.trim() }
      const res = await fetch('/api/meta/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) setToken('')
    } finally {
      setLoading(false)
    }
  }

  const copy = (t: string) => {
    navigator.clipboard.writeText(t)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Token Meta Ads</h1>
        <p className="text-gray-400 text-sm mt-1">
          Pega tu token de acceso. Si es permanente, guárdalo directo. Si es corto, conviértelo a 60 días.
        </p>
      </div>

      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
          Token de acceso Meta
        </label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="EAARFxa..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        {/* Dos botones */}
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => save(true)}
            disabled={loading || !token.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✅'}
            Guardar directo
          </button>
          <button
            onClick={() => save(false)}
            disabled={loading || !token.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '🔄'}
            Convertir a 60 días
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-2">
          <strong className="text-gray-500">Guardar directo</strong> — para tokens permanentes o ya extendidos · <strong className="text-gray-500">Convertir</strong> — para tokens cortos del Graph API Explorer
        </p>
      </div>

      {/* Resultado */}
      {result && (
        <div className={`border rounded-xl p-5 mb-5 ${result.success ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
          {result.success ? (
            <>
              <p className="text-green-300 font-semibold mb-1">
                {result.permanent
                  ? '✅ Token guardado en Vercel'
                  : `✅ Token convertido · válido por ${result.daysLeft} días`}
              </p>
              <p className="text-gray-400 text-xs mb-3">
                {result.vercelUpdated
                  ? 'Actualizado en Vercel automáticamente. Haz un nuevo deploy para que tome efecto.'
                  : 'No se pudo actualizar Vercel automáticamente. Actualiza META_ACCESS_TOKEN manualmente.'}
              </p>
              {result.token && (
                <button
                  onClick={() => copy(result.token!)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                >
                  {copied ? '✓ Copiado' : 'Copiar token'}
                </button>
              )}
            </>
          ) : (
            <p className="text-red-300 text-sm">{result.error}</p>
          )}
        </div>
      )}

      {/* Instrucciones para token corto */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-gray-500 text-xs font-semibold mb-2">Para obtener un token corto:</p>
        <ol className="space-y-1 text-xs text-gray-500">
          <li>1. Ve a <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">developers.facebook.com/tools/explorer</a></li>
          <li>2. Selecciona tu app · agrega permisos <code className="bg-gray-800 px-1 rounded">ads_read</code> y <code className="bg-gray-800 px-1 rounded">ads_management</code></li>
          <li>3. Haz clic en <strong className="text-gray-400">Generate Access Token</strong></li>
        </ol>
      </div>
    </div>
  )
}
