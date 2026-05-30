import { useEffect, useMemo, useState } from 'react'
import { EmptyState, SectionHeader } from '../components/common'
import type { UserAccount, WalletSummary, WalletTransaction } from '../types'
import {
  buildAdminUsersEndpoint,
  buildAdminWalletTopUpEndpoint,
  buildAuthHeaders,
  buildJsonAuthHeaders,
  buildWalletMyEndpoint,
  buildWalletMyTopUpEndpoint,
  buildWalletMyTransactionsEndpoint,
} from '../../api'
import { formatCurrency, formatDateTime } from '../utils'
import {
  ensureOk,
  extractCollection,
  getNumberValue,
  getStringValue,
  parseResponsePayload,
} from './apiHelpers'

type FinanceFilter = 'all' | 'topup' | 'credit' | 'debit'

function normalizeWalletSummary(rawSummary: unknown): WalletSummary {
  const summary = (rawSummary && typeof rawSummary === 'object' ? rawSummary : {}) as Record<string, unknown>

  return {
    balance: getNumberValue(summary, ['balance', 'saldo', 'amount'], 0) ?? 0,
    currency: getStringValue(summary, ['currency', 'moneda'], 'GTQ') || 'GTQ',
    availableBalance: getNumberValue(summary, ['availableBalance', 'available_balance', 'saldoDisponible']),
    updatedAt: getStringValue(summary, ['updatedAt', 'updated_at'], '') || null,
  }
}

function normalizeWalletTransaction(rawTransaction: unknown): WalletTransaction {
  const transaction = (rawTransaction && typeof rawTransaction === 'object'
    ? rawTransaction
    : {}) as Record<string, unknown>

  return {
    id: getStringValue(transaction, ['id', 'transactionId', 'transaction_id']),
    type: getStringValue(transaction, ['type', 'transactionType', 'movementType'], 'MOVEMENT').toUpperCase(),
    amount: getNumberValue(transaction, ['amount', 'monto', 'value'], 0) ?? 0,
    status: getStringValue(transaction, ['status', 'estado'], 'REGISTERED').toUpperCase(),
    paymentMethod: getStringValue(transaction, ['paymentMethod', 'payment_method', 'metodoPago'], 'N/D'),
    description: getStringValue(transaction, ['description', 'descripcion', 'detail', 'details'], 'Sin descripcion'),
    reference: getStringValue(transaction, ['reference', 'referenceCode', 'reference_code'], ''),
    createdAt: getStringValue(transaction, ['createdAt', 'created_at'], new Date().toISOString()),
  }
}

function normalizeUserOption(rawUser: unknown): UserAccount {
  const user = (rawUser && typeof rawUser === 'object' ? rawUser : {}) as Record<string, unknown>
  const firstName = getStringValue(user, ['firstName', 'first_name', 'name'])
  const lastName = getStringValue(user, ['lastName', 'last_name'])

  return {
    id: getStringValue(user, ['id', 'userId', 'user_id']),
    firstName,
    lastName,
    email: getStringValue(user, ['email']),
    phone: getStringValue(user, ['phone']),
    role: getStringValue(user, ['role', 'role.name'], 'USER').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
    status: getStringValue(user, ['status', 'status.name'], 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    emailVerified: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function getDisplayName(user: UserAccount) {
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  return fullName || user.email || `Usuario #${user.id}`
}

function getTransactionTone(transaction: WalletTransaction) {
  if (transaction.amount < 0) {
    return 'red'
  }

  if (transaction.type.includes('TOP') || transaction.type.includes('CREDIT')) {
    return 'green'
  }

  return 'blue'
}

export function FinanceSection({ authToken }: { authToken: string }) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [filter, setFilter] = useState<FinanceFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [myTopUpAmount, setMyTopUpAmount] = useState('')
  const [myPaymentMethod, setMyPaymentMethod] = useState('CARD')
  const [adminUserId, setAdminUserId] = useState('')
  const [adminAmount, setAdminAmount] = useState('')
  const [pendingAction, setPendingAction] = useState<'my' | 'admin' | null>(null)

  useEffect(() => {
    let isCancelled = false

    const loadFinanceData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [walletResponse, transactionsResponse, usersResponse] = await Promise.all([
          fetch(buildWalletMyEndpoint(), {
            headers: buildAuthHeaders(authToken),
          }),
          fetch(buildWalletMyTransactionsEndpoint(), {
            headers: buildAuthHeaders(authToken),
          }),
          fetch(buildAdminUsersEndpoint(), {
            headers: buildAuthHeaders(authToken),
          }),
        ])

        const [walletPayload, transactionsPayload, usersPayload] = await Promise.all([
          parseResponsePayload(walletResponse),
          parseResponsePayload(transactionsResponse),
          parseResponsePayload(usersResponse),
        ])

        ensureOk(walletResponse, walletPayload, 'No se pudo cargar el wallet.')
        ensureOk(transactionsResponse, transactionsPayload, 'No se pudieron cargar las transacciones.')
        ensureOk(usersResponse, usersPayload, 'No se pudieron cargar los usuarios para recargas.')

        const normalizedWallet = normalizeWalletSummary(
          walletPayload && typeof walletPayload === 'object' ? ((walletPayload as Record<string, unknown>).data ?? walletPayload) : walletPayload,
        )
        const normalizedTransactions = (extractCollection(transactionsPayload) ?? [])
          .map(normalizeWalletTransaction)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        const normalizedUsers = (extractCollection(usersPayload) ?? [])
          .map(normalizeUserOption)
          .filter((user) => user.status === 'ACTIVE')
          .sort((left, right) => getDisplayName(left).localeCompare(getDisplayName(right)))

        if (isCancelled) {
          return
        }

        setWallet(normalizedWallet)
        setTransactions(normalizedTransactions)
        setUsers(normalizedUsers)
        setAdminUserId((current) => current || normalizedUsers[0]?.id || '')
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar finanzas.')
          setWallet(null)
          setTransactions([])
          setUsers([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadFinanceData()

    return () => {
      isCancelled = true
    }
  }, [authToken])

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') {
      return transactions
    }

    if (filter === 'topup') {
      return transactions.filter((transaction) => transaction.type.includes('TOP'))
    }

    if (filter === 'credit') {
      return transactions.filter((transaction) => transaction.amount >= 0)
    }

    return transactions.filter((transaction) => transaction.amount < 0)
  }, [filter, transactions])

  const totalTopUps = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((total, transaction) => total + transaction.amount, 0),
    [transactions],
  )

  const submitMyTopUp = async () => {
    const amount = Number(myTopUpAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }

    setPendingAction('my')
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(buildWalletMyTopUpEndpoint(), {
        method: 'POST',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          amount,
          paymentMethod: myPaymentMethod,
        }),
      })
      const payload = await parseResponsePayload(response)
      ensureOk(response, payload, 'No se pudo registrar la recarga personal.')

      const transaction = normalizeWalletTransaction(
        payload && typeof payload === 'object' ? ((payload as Record<string, unknown>).data ?? payload) : payload,
      )

      setTransactions((current) => [transaction, ...current])
      setWallet((current) =>
        current
          ? {
              ...current,
              balance: current.balance + amount,
              availableBalance: current.availableBalance === null ? null : current.availableBalance + amount,
              updatedAt: new Date().toISOString(),
            }
          : current,
      )
      setMyTopUpAmount('')
      setMessage('Recarga personal registrada correctamente.')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar la recarga.')
    } finally {
      setPendingAction(null)
    }
  }

  const submitAdminTopUp = async () => {
    const amount = Number(adminAmount)

    if (!adminUserId || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    setPendingAction('admin')
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(buildAdminWalletTopUpEndpoint(), {
        method: 'POST',
        headers: buildJsonAuthHeaders(authToken),
        body: JSON.stringify({
          userId: Number(adminUserId),
          amount,
        }),
      })
      const payload = await parseResponsePayload(response)
      ensureOk(response, payload, 'No se pudo registrar la recarga administrativa.')

      setAdminAmount('')
      setMessage(`Recarga administrativa aplicada al usuario #${adminUserId}.`)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'No se pudo registrar la recarga administrativa.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <SectionHeader title="Finanzas" subtitle="Controla wallet, movimientos y recargas operativas desde el panel admin." />

      <section className="summary-grid">
        <article className="card summary-card">
          <span className="summary-card__label">Balance actual</span>
          <strong>{wallet ? formatCurrency(wallet.balance, wallet.currency) : 'Sin dato'}</strong>
          <p>{wallet?.updatedAt ? `Actualizado: ${formatDateTime(wallet.updatedAt)}` : 'Wallet sin timestamp.'}</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Movimientos</span>
          <strong>{transactions.length}</strong>
          <p>{filteredTransactions.length} visibles en la vista actual.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-card__label">Recargas acumuladas</span>
          <strong>{wallet ? formatCurrency(totalTopUps, wallet.currency) : 'Sin dato'}</strong>
          <p>{users.length} usuarios activos disponibles para recarga admin.</p>
        </article>
      </section>

      <section className="content-grid admin-detail-grid">
        <article className="card detail-card">
          <div className="card-head">
            <h2>Recargas</h2>
            <span className="tag tag--blue">Wallet</span>
          </div>

          {isLoading ? (
            <EmptyState title="Cargando finanzas" copy="Consultando wallet y movimientos reales desde la API." />
          ) : error ? (
            <EmptyState title="No se pudo cargar finanzas" copy={error} />
          ) : (
            <div className="record-list">
              <article className="record-card">
                <div className="record-card__header">
                  <div>
                    <strong>Recarga personal</strong>
                    <p>Aplica una carga al wallet del usuario autenticado.</p>
                  </div>
                  <span className="tag tag--green">Mi wallet</span>
                </div>

                <div className="control-group">
                  <label className="control">
                    <span>Monto</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={myTopUpAmount}
                      onChange={(event) => setMyTopUpAmount(event.target.value)}
                      placeholder="100.00"
                    />
                  </label>
                  <label className="control">
                    <span>Metodo</span>
                    <select value={myPaymentMethod} onChange={(event) => setMyPaymentMethod(event.target.value)}>
                      <option value="CARD">CARD</option>
                      <option value="CASH">CASH</option>
                      <option value="TRANSFER">TRANSFER</option>
                    </select>
                  </label>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void submitMyTopUp()}
                    disabled={pendingAction === 'my'}
                  >
                    {pendingAction === 'my' ? 'Registrando...' : 'Registrar recarga personal'}
                  </button>
                </div>
              </article>

              <article className="record-card">
                <div className="record-card__header">
                  <div>
                    <strong>Recarga administrativa</strong>
                    <p>Asigna saldo directamente a cualquier usuario activo.</p>
                  </div>
                  <span className="tag tag--orange">ADMIN</span>
                </div>

                <div className="control-group">
                  <label className="control">
                    <span>Usuario</span>
                    <select value={adminUserId} onChange={(event) => setAdminUserId(event.target.value)}>
                      <option value="">Selecciona un usuario</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {getDisplayName(user)} - {user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control">
                    <span>Monto</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={adminAmount}
                      onChange={(event) => setAdminAmount(event.target.value)}
                      placeholder="100.00"
                    />
                  </label>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void submitAdminTopUp()}
                    disabled={pendingAction === 'admin' || !adminUserId}
                  >
                    {pendingAction === 'admin' ? 'Aplicando...' : 'Aplicar recarga admin'}
                  </button>
                </div>
              </article>

              {message ? (
                <div className="fleet-note-card fleet-note-card--compact">
                  <strong>Operacion completada</strong>
                  <p>{message}</p>
                </div>
              ) : null}
            </div>
          )}
        </article>

        <article className="card detail-card">
          <div className="card-head">
            <h2>Movimientos</h2>
            <span className="tag tag--blue">API</span>
          </div>

          <div className="analytics-filter-bar">
            {(['all', 'topup', 'credit', 'debit'] as FinanceFilter[]).map((currentFilter) => (
              <button
                key={currentFilter}
                type="button"
                className={`analytics-filter-chip${filter === currentFilter ? ' analytics-filter-chip--active' : ''}`}
                onClick={() => setFilter(currentFilter)}
              >
                {currentFilter === 'all'
                  ? 'Todos'
                  : currentFilter === 'topup'
                    ? 'Top-ups'
                    : currentFilter === 'credit'
                      ? 'Creditos'
                      : 'Debitos'}
              </button>
            ))}
          </div>

          {isLoading ? (
            <EmptyState title="Cargando movimientos" copy="Esperando historial financiero." />
          ) : error ? (
            <EmptyState title="Sin movimientos visibles" copy={error} />
          ) : filteredTransactions.length === 0 ? (
            <EmptyState title="Sin movimientos" copy="No hay transacciones que coincidan con el filtro actual." />
          ) : (
            <div className="record-list">
              {filteredTransactions.map((transaction) => (
                <article key={transaction.id} className="record-card">
                  <div className="record-card__header">
                    <div>
                      <strong>{transaction.description}</strong>
                      <p>{transaction.reference || transaction.type}</p>
                    </div>
                    <span className={`tag tag--${getTransactionTone(transaction)}`}>
                      {wallet ? formatCurrency(transaction.amount, wallet.currency) : transaction.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="record-card__meta">
                    <span>Estado: {transaction.status}</span>
                    <span>Metodo: {transaction.paymentMethod}</span>
                    <span>Fecha: {formatDateTime(transaction.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  )
}
