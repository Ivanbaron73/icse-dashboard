'use client'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 990,
    period: 'mes',
    description: 'Para clínicas pequeñas',
    features: [
      '1 clínica',
      'Meta Ads + Funnelead',
      'Reportes semanales',
      'Soporte por correo',
    ],
    color: 'gray',
    current: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 2490,
    period: 'mes',
    description: 'Para clínicas en crecimiento',
    features: [
      'Hasta 3 clínicas',
      'Meta Ads + Funnelead',
      'Reportes automáticos',
      'PDF branded',
      'Soporte prioritario',
    ],
    color: 'blue',
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    period: 'personalizado',
    description: 'Para cadenas de clínicas',
    features: [
      'Clínicas ilimitadas',
      'Integraciones personalizadas',
      'API access',
      'Soporte dedicado 24/7',
      'SLA garantizado',
    ],
    color: 'purple',
    current: false,
  },
]

export default function FacturacionPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Facturación</h1>
        <p className="text-gray-400 text-sm mt-1">
          Gestiona tu suscripción y métodos de pago.
        </p>
      </div>

      {/* Current plan banner */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">Plan actual</p>
          <p className="text-white font-bold text-lg">Pro · $2,490 MXN/mes</p>
          <p className="text-gray-400 text-sm mt-0.5">Próxima renovación: 17 de abril de 2026</p>
        </div>
        <div className="text-right">
          <span className="bg-green-500/20 text-green-300 text-sm px-3 py-1 rounded-full font-medium">Activo</span>
        </div>
      </div>

      {/* Plans */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Planes disponibles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`bg-gray-900 border rounded-xl p-5 relative ${
              plan.current
                ? 'border-blue-500/50 bg-blue-900/10'
                : 'border-gray-800'
            }`}
          >
            {plan.current && (
              <span className="absolute -top-2.5 left-4 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                Plan actual
              </span>
            )}
            <h3 className="text-white font-bold text-lg">{plan.name}</h3>
            <p className="text-gray-500 text-xs mb-4">{plan.description}</p>
            <div className="mb-4">
              {plan.price > 0 ? (
                <>
                  <span className="text-3xl font-bold text-white">${plan.price.toLocaleString('es-MX')}</span>
                  <span className="text-gray-500 text-sm"> MXN/{plan.period}</span>
                </>
              ) : (
                <span className="text-xl font-bold text-purple-300">Contactar ventas</span>
              )}
            </div>
            <ul className="space-y-2 mb-5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-green-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                plan.current
                  ? 'bg-gray-800 text-gray-500 cursor-default'
                  : plan.id === 'enterprise'
                  ? 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {plan.current ? 'Plan actual' : plan.id === 'enterprise' ? 'Contactar' : 'Cambiar plan'}
            </button>
          </div>
        ))}
      </div>

      {/* Payment method */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h3 className="text-white font-semibold mb-4">Método de pago</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
              VISA
            </div>
            <div>
              <p className="text-white text-sm">•••• •••• •••• 4242</p>
              <p className="text-gray-500 text-xs">Vence 12/2027</p>
            </div>
          </div>
          <button className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Cambiar
          </button>
        </div>
      </div>

      <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-yellow-300 text-xs font-semibold mb-1">⚠ Módulo en preparación</p>
        <p className="text-gray-500 text-xs">
          La integración con Stripe está preparada. Los cobros se activarán una vez que
          se configuren las credenciales de Stripe en el sistema.
        </p>
      </div>
    </div>
  )
}
