'use client'

import { useState, useEffect } from 'react'

interface Workspace {
  id: string
  name: string
  location: string
  metaAccountId: string
  ghlLocationId: string
  active: boolean
}

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'icse-main',
    name: 'Instituto de Cosmetología Spa y Estética ICSE',
    location: 'Cancún / Mérida',
    metaAccountId: 'act_657187014812151',
    ghlLocationId: 'wZp2vtSN5qcoOindoLbs',
    active: true,
  },
]

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLocation, setNewLocation] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('icse_workspaces')
    if (saved) setWorkspaces(JSON.parse(saved))
  }, [])

  const saveWorkspaces = (list: Workspace[]) => {
    setWorkspaces(list)
    localStorage.setItem('icse_workspaces', JSON.stringify(list))
  }

  const addWorkspace = () => {
    if (!newName.trim()) return
    const next: Workspace = {
      id: `ws-${Date.now()}`,
      name: newName,
      location: newLocation,
      metaAccountId: '',
      ghlLocationId: '',
      active: false,
    }
    saveWorkspaces([...workspaces, next])
    setNewName('')
    setNewLocation('')
    setShowForm(false)
  }

  const setActive = (id: string) => {
    saveWorkspaces(workspaces.map((w) => ({ ...w, active: w.id === id })))
  }

  const remove = (id: string) => {
    if (workspaces.find((w) => w.id === id)?.active) return
    saveWorkspaces(workspaces.filter((w) => w.id !== id))
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Clínicas / Workspaces</h1>
          <p className="text-gray-400 text-sm mt-1">
            Cada clínica tiene sus datos aislados. Selecciona la activa.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Nueva Clínica
        </button>
      </div>

      {/* Add workspace form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-4">Agregar Clínica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Nombre de la clínica</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. ICSE Playa del Carmen"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Ubicación</label>
              <input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Ciudad, Estado"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={addWorkspace}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Workspaces list */}
      <div className="space-y-4">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`bg-gray-900 border rounded-xl p-5 flex items-start justify-between gap-4 ${
              ws.active ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-800'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
                ws.active ? 'bg-blue-600' : 'bg-gray-800'
              }`}>
                🏥
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-sm">{ws.name}</h3>
                  {ws.active && (
                    <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">
                      Activa
                    </span>
                  )}
                </div>
                {ws.location && (
                  <p className="text-gray-500 text-xs mt-0.5">📍 {ws.location}</p>
                )}
                <div className="flex gap-4 mt-2">
                  {ws.metaAccountId && (
                    <p className="text-gray-600 text-xs">
                      <span className="text-gray-500">Meta:</span> {ws.metaAccountId}
                    </p>
                  )}
                  {ws.ghlLocationId && (
                    <p className="text-gray-600 text-xs">
                      <span className="text-gray-500">Funnelead:</span> {ws.ghlLocationId}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {!ws.active && (
                <button
                  onClick={() => setActive(ws.id)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white text-xs rounded-lg transition-colors"
                >
                  Activar
                </button>
              )}
              {!ws.active && (
                <button
                  onClick={() => remove(ws.id)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-300 text-xs rounded-lg transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <h3 className="text-gray-300 font-medium text-sm mb-2">🔮 Próximamente</h3>
        <p className="text-gray-500 text-xs">
          El módulo de Workspaces está preparado para multi-clínica. Cuando se conecte Supabase,
          cada clínica tendrá usuarios, datos y reportes completamente aislados.
        </p>
      </div>
    </div>
  )
}
