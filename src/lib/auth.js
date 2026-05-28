const ACCOUNTS_KEY = 'bvwc_accounts'
const SESSION_KEY = 'bvwc_session'

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password)
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export async function login(username, password) {
  const accounts = loadAccounts()
  const account = accounts.find(a => a.username.toLowerCase() === username.toLowerCase().trim())
  if (!account) throw new Error('Account not found')

  const hash = await hashPassword(password)
  if (hash !== account.passwordHash) throw new Error('Incorrect password')

  const session = { accountId: account.id, username: account.username }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export async function createAccount(username, password) {
  const trimmed = username.trim()
  if (!trimmed) throw new Error('Username cannot be empty')
  if (password.length < 4) throw new Error('Password must be at least 4 characters')

  const accounts = loadAccounts()
  if (accounts.find(a => a.username.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Username already taken')
  }

  const hash = await hashPassword(password)
  const account = { id: crypto.randomUUID(), username: trimmed, passwordHash: hash }
  accounts.push(account)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))

  const session = { accountId: account.id, username: trimmed }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}
