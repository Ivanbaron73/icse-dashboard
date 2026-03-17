import { NextResponse } from 'next/server'

// GET /api/exchange-rate → { rate: number, source: string, timestamp: string }
export async function GET() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      next: { revalidate: 3600 }, // cache 1 hora
    })

    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`)

    const data = await res.json()
    const rate: number = data.rates?.MXN ?? 17.5

    return NextResponse.json({
      rate,
      source: 'exchangerate-api.com',
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Fallback: tipo de cambio aproximado
    return NextResponse.json({
      rate: 17.5,
      source: 'fallback',
      timestamp: new Date().toISOString(),
    })
  }
}
