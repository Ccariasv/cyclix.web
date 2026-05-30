import { useEffect, useMemo, useState } from 'react'
import { EmptyState, SectionHeader } from '../components/common'
import type { UserAccount } from '../types'
import {
  buildAdminUserRoleEndpoint,
  buildAdminUsersEndpoint,
  buildAdminUserStatusEndpoint,
  buildAuthHeaders,
  buildJsonAuthHeaders,
} from '../../api'
import { formatDateTime } from '../utils'
import {
  ensureOk,
  extractCollection,
  getBooleanValue,
  getStringValue,
  parseResponsePayload,
} from './apiHelpers'

type RoleFilter = 'all' | 'ADMIN' | 'USER'
type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'

function normalizeUser(rawUser: unknown): UserAccount {
  const user = (rawUser && typeof rawUser === 'object' ? rawUser : {}) as Record<string, unknown>
  const createdAt = getStringValue(user, ['createdAt', 'created_at'], new Date().toISOString())
  const updatedAt = getStringValue(user, ['updatedAt', 'updated_at'], createdAt)
  const role = getStringValue(user, ['role', 'role.name'], 'USER').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER'
  const status = getStringValue(user, ['status', 'status.name'], 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

  return {
    id: getStringValue(user, ['id', 'userId', 'user_id']),
    firstName: getStringValue(user, ['firstName', 'first_name', 'name']),
    lastName: getStringValue(user, ['lastName', 'last_name']),
    email: getStringValue(user, ['email']),
    phone: getStringValue(user, ['phone']),
    role,
    status,
    emailVerified: getBooleanValue(user, ['emailVerified', 'email_verified']),
    lastLoginAt: getStringValue(user, ['lastLoginAt', 'last_login_at'], '') || null,
    createdAt,
    updatedAt,
  }
}

function getRoleTone(role: UserAccount['role']) {
  return role === 'ADMIN' ? 'orange' : 'blue'
}

function getStatusTone(status: UserAccount['status']) {
  return status === 'ACTIVE' ? 'green' : 'red'
}

function getDisplayName(user: UserAccount) {
  const name = `${user.firstName} ${user.lastName}`.trim()
  return name || user.email || `Usuario #${user.id}`
}

export function UsersSection({ authToken }: { authToken: string }) {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<Record<string, 'role' | 'status' | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})

  useEffect(() => {
    let isCancelled = false

    const loadUsers = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(buildAdminUsersEndpoint(), {
          headers: buildAuthHeaders(authToken),
        })
        const payload = await parseResponsePayload(response)
        ensureOk(response, payload, 'No se pudieron cargar los usuarios.')

        const rawUsers = extractCollection(payload)
        const normalizedUsers = (rawUsers ?? []).map(normalizeUser).sort((left, right) =>
          getDisplayName(left).localeCompare(getDisplayName(right)),
        )

        if (isCancelled) {
          return
        }

        setUsers(normalizedUsers)
        setSelectedUserId((current) =>
          current && normalizedUsers.some((user) => user.id === current) ? current : (normalizedUsers[0]?.id ?? null),
        )
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los usuarios.')
          setUsers([])
          setSelectedUserId(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      isCancelled = true
    }
  }, [authToken])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false
      }

      if (statusFilter !== 'all' && user.status !== statusFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [getDisplayName(user), user.email, user.phone, user.id].join(' ').toLowerCase().includes(normalizedSearch)
    })
  }, [roleFilter, search, statusFilter, users])

  const selectedUser =
    (selectedUserId ? filteredUsers.find((user) => user.id === selectedUserId) : null) ??
    (selectedUserId ? users.find((user) => user.id === selectedUserId) : null) ??
    filteredUsers[0] ??
    null

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === 'ADMIN').length,
      active: users.filter((user) => user.status === 'ACTIVE').length,
      verified: users.filter((user) => user.emailVerified).length,
    }),
    [users],
  )

  const handleRoleChange = async (userId: string, role: UserAccount['role']) => {
    setPendingAction((current) => ({ ...current, [userId]: 'role' }))
    setRowErrors((current) => ({ ...current, [userId]: null }))

    try {
      const response = await fetch(buildAdminUserRoleEndpoint(userId), {
        method: 'PATCH',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({ role }),
      })
      const payload = await parseResponsePayload(response)
      ensureOk(response, payload, 'No se pudo actualizar el rol del usuario.')

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                role,
                updatedAt: new Date().toISOString(),
              }
            : user,
        ),
      )
    } catch (updateError) {
      setRowErrors((current) => ({
        ...current,
        [userId]: updateError instanceof Error ? updateError.message : 'No se pudo actualizar el rol.',
      }))
    } finally {
      setPendingAction((current) => ({ ...current, [userId]: null }))
    }
  }

  const handleStatusChange = async (userId: string, status: UserAccount['status']) => {
    setPendingAction((current) => ({ ...current, [userId]: 'status' }))
    setRowErrors((current) => ({ ...current, [userId]: null }))

    try {
      const response = await fetch(buildAdminUserStatusEndpoint(userId), {
        method: 'PATCH',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({ status }),
      })
      const payload = await parseResponsePayload(response)
      ensureOk(response, payload, 'No se pudo actualizar el estado del usuario.')

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                status,
                updatedAt: new Date().toISOString(),
              }
            : user,
        ),
      )
    } catch (updateError) {
      setRowErrors((current) => ({
        ...current,
        [userId]: updateError instanceof Error ? updateError.message : 'No se pudo actualizar el estado.',
      }))
    } finally {
      setPendingAction((current) => ({ ...current, [userId]: null }))
    }
  }

  return (
    <>
      <SectionHeader title="Usuarios" subtitle="Gestiona estado, rol y visibilidad operativa de cada cuenta." />

      <section className="summary-grid">
        <article className="card summary-card">
          <span className="summary-card__label">Usuarios registrados</span>
          <strong>{stats.total}</strong>
          <p>{filteredUsers.length} visibles en la vista actual.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Administradores</span>
          <strong>{stats.admins}</strong>
          <p>{stats.total - stats.admins} usuarios finales.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Activos / verificados</span>
          <strong>
            {stats.active} / {stats.verified}
          </strong>
          <p>Cuentas listas para operar y autenticarse.</p>
        </article>
      </section>

      <section className="card detail-card analytics-filter-panel">
        <div className="card-head">
          <h2>Filtros</h2>
          <span className="tag tag--blue">{filteredUsers.length} visibles</span>
        </div>

        <div className="analytics-filter-bar">
          {(['all', 'ADMIN', 'USER'] as RoleFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`analytics-filter-chip${roleFilter === filter ? ' analytics-filter-chip--active' : ''}`}
              onClick={() => setRoleFilter(filter)}
            >
              {filter === 'all' ? 'Todos los roles' : filter}
            </button>
          ))}
          {(['all', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`analytics-filter-chip${statusFilter === filter ? ' analytics-filter-chip--active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? 'Todos los estados' : filter === 'ACTIVE' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>

        <div className="control-group">
          <label className="control control--full">
            <span>Buscar por nombre, correo, telefono o id</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. laura, admin@cyclix.test o 15"
            />
          </label>
        </div>
      </section>

      <section className="content-grid admin-detail-grid">
        <article className="card detail-card">
          <div className="card-head">
            <h2>Listado de usuarios</h2>
            <span className="tag tag--blue">ADMIN</span>
          </div>

          {isLoading ? (
            <EmptyState title="Cargando usuarios" copy="Consultando usuarios reales desde la API." />
          ) : error ? (
            <EmptyState title="No se pudieron cargar usuarios" copy={error} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState title="Sin coincidencias" copy="No hay usuarios que coincidan con los filtros actuales." />
          ) : (
            <div className="record-list">
              {filteredUsers.map((user) => (
                <article
                  key={user.id}
                  className={`record-card admin-select-card${selectedUser?.id === user.id ? ' admin-select-card--active' : ''}`}
                >
                  <button type="button" className="admin-select-card__hit" onClick={() => setSelectedUserId(user.id)}>
                    <div className="record-card__header">
                      <div>
                        <strong>{getDisplayName(user)}</strong>
                        <p>{user.email}</p>
                      </div>
                      <div className="admin-inline-tags">
                        <span className={`tag tag--${getRoleTone(user.role)}`}>{user.role}</span>
                        <span className={`tag tag--${getStatusTone(user.status)}`}>
                          {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="record-card__meta">
                    <span>Telefono: {user.phone || 'Sin telefono'}</span>
                    <span>Ultimo login: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Sin registro'}</span>
                  </div>

                  <div className="support-ticket__controls">
                    <label className="control support-ticket__control">
                      <span>Rol</span>
                      <select
                        value={user.role}
                        onChange={(event) => void handleRoleChange(user.id, event.target.value as UserAccount['role'])}
                        disabled={pendingAction[user.id] !== undefined && pendingAction[user.id] !== null}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </label>

                    <label className="control support-ticket__control">
                      <span>Estado</span>
                      <select
                        value={user.status}
                        onChange={(event) => void handleStatusChange(user.id, event.target.value as UserAccount['status'])}
                        disabled={pendingAction[user.id] !== undefined && pendingAction[user.id] !== null}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </label>
                  </div>

                  {rowErrors[user.id] ? <p className="support-ticket__feedback support-ticket__feedback--error">{rowErrors[user.id]}</p> : null}
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card detail-card">
          <div className="card-head">
            <h2>Detalle</h2>
            <span className={`tag tag--${selectedUser ? getRoleTone(selectedUser.role) : 'blue'}`}>
              {selectedUser ? 'Usuario' : 'Sin seleccion'}
            </span>
          </div>

          {!selectedUser ? (
            <EmptyState title="Sin usuario seleccionado" copy="Selecciona una cuenta para ver mas contexto operativo." />
          ) : (
            <div className="record-list">
              <article className="record-card">
                <div className="record-card__header">
                  <div>
                    <strong>{getDisplayName(selectedUser)}</strong>
                    <p>{selectedUser.email}</p>
                  </div>
                  <div className="admin-inline-tags">
                    <span className={`tag tag--${getRoleTone(selectedUser.role)}`}>{selectedUser.role}</span>
                    <span className={`tag tag--${getStatusTone(selectedUser.status)}`}>
                      {selectedUser.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="fleet-detail-list">
                  <div className="fleet-detail-list__row">
                    <span>ID</span>
                    <strong>{selectedUser.id}</strong>
                  </div>
                  <div className="fleet-detail-list__row">
                    <span>Telefono</span>
                    <strong>{selectedUser.phone || 'Sin telefono'}</strong>
                  </div>
                  <div className="fleet-detail-list__row">
                    <span>Email verificado</span>
                    <strong>{selectedUser.emailVerified ? 'Si' : 'No'}</strong>
                  </div>
                  <div className="fleet-detail-list__row">
                    <span>Creado</span>
                    <strong>{formatDateTime(selectedUser.createdAt)}</strong>
                  </div>
                  <div className="fleet-detail-list__row">
                    <span>Actualizado</span>
                    <strong>{formatDateTime(selectedUser.updatedAt)}</strong>
                  </div>
                  <div className="fleet-detail-list__row">
                    <span>Ultimo login</span>
                    <strong>{selectedUser.lastLoginAt ? formatDateTime(selectedUser.lastLoginAt) : 'Sin registro'}</strong>
                  </div>
                </div>
              </article>
            </div>
          )}
        </article>
      </section>
    </>
  )
}
