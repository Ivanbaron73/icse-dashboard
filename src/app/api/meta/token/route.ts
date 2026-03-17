import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com'

// GET /api/meta/token → verifica validez del token actual
export async function GET() {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN no configurado' }, { status: 400 })
  }

  try {
    // Usar app access token si está disponible (más fiable con tokens expirados)
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    const appToken = appId && appSecret ? `${appId}|${appSecret}` : token

    const res = await fetch(
      `${BASE}/debug_token?input_token=${token}&access_token=${appToken}`,
      { cache: 'no-store' }
    )
    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ valid: false, error: data.error.message })
    }

    const info = data.data ?? {}
    const expiresAt = info.expires_at
      ? new Date(info.expires_at * 1000).toISOString()
      : null
    const daysLeft = expiresAt
      ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
      : null

    return NextResponse.json({
      valid: info.is_valid ?? false,
      expiresAt,
      daysLeft,
      scopes: info.scopes ?? [],
      type: info.type ?? 'unknown',
    })
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

// POST /api/meta/token → intercambia token corto por Long-Lived Token (60 días)
// Body: { appId: string, appSecret: string, shortLivedToken?: string }
// Si shortLivedToken se omite, usa META_ACCESS_TOKEN del entorno
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const appId = body.appId ?? process.env.META_APP_ID
  const appSecret = body.appSecret ?? process.env.META_APP_SECRET
  const shortToken = body.shortLivedToken ?? process.env.META_ACCESS_TOKEN

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: 'Se requieren META_APP_ID y META_APP_SECRET. Configúralos en las variables de entorno.' },
      { status: 400 }
    )
  }

  if (!shortToken) {
    return NextResponse.json(
      { error: 'No hay token disponible para intercambiar.' },
      { status: 400 }
    )
  }

  try {
    const url =
      `${BASE}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${shortToken}`

    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (data.error) {
      return NextResponse.json({ success: false, error: data.error.message }, { status: 400 })
    }

    const newToken: string = data.access_token
    const expiresInSeconds: number = data.expires_in ?? 5_184_000 // 60 días default
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    const daysLeft = Math.floor(expiresInSeconds / 86_400)

    // Si hay VERCEL_API_TOKEN, actualizar env var automáticamente
    const vercelToken = process.env.VERCEL_API_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID ?? 'prj_oXhOOKM1iu1wWdPHgorQeBcEVqLZ'

    let vercelUpdated = false
    if (vercelToken) {
      try {
        // Obtener el env var ID actual
        const listRes = await fetch(
          `https://api.vercel.com/v9/projects/${projectId}/env`,
          { headers: { Authorization: `Bearer ${vercelToken}` } }
        )
        const listData = await listRes.json()
        const envVar = (listData.envs ?? []).find(
          (e: { key: string }) => e.key === 'META_ACCESS_TOKEN'
        )

        if (envVar?.id) {
          await fetch(
            `https://api.vercel.com/v9/projects/${projectId}/env/${envVar.id}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${vercelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ value: newToken }),
            }
          )
          vercelUpdated = true
        }
      } catch {
        // No crítico, continuar
      }
    }

    return NextResponse.json({
      success: true,
      token: newToken,
      expiresAt,
      daysLeft,
      vercelUpdated,
      instructions: vercelUpdated
        ? 'Token actualizado en Vercel. Haz un nuevo deploy para que tome efecto.'
        : `Copia este token y actualízalo manualmente en: vercel.com/iaibaronz-2361s-projects/icse-dashboard/settings/environment-variables\nVariable: META_ACCESS_TOKEN`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
