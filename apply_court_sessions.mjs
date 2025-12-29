import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let singleQuote = false
  let doubleQuote = false
  let dollarTag = null
  let lineComment = false
  let blockComment = false

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed) statements.push(trimmed)
    current = ''
  }

  let i = 0
  while (i < sql.length) {
    const char = sql[i]
    const next = sql[i + 1] || ''

    if (lineComment) {
      current += char
      if (char === '\n') lineComment = false
      i++
      continue
    }

    if (blockComment) {
      current += char
      if (char === '*' && next === '/') {
        current += '/'
        blockComment = false
        i += 2
        continue
      }
      i++
      continue
    }

    if (dollarTag !== null) {
      current += char
      const closing = `$${dollarTag}$`
      if (sql.startsWith(closing, i)) {
        dollarTag = null
      }
      i++
      continue
    }

    if (singleQuote) {
      current += char
      if (char === '\'') {
        if (next === '\'') {
          current += '\''
          i += 2
          continue
        }
        singleQuote = false
      }
      i++
      continue
    }

    if (doubleQuote) {
      current += char
      if (char === '"') {
        if (next === '"') {
          current += '"'
          i += 2
          continue
        }
        doubleQuote = false
      }
      i++
      continue
    }

    if (char === '-' && next === '-') {
      current += '--'
      lineComment = true
      i += 2
      continue
    }

    if (char === '/' && next === '*') {
      current += '/*'
      blockComment = true
      i += 2
      continue
    }

    if (char === '\'') {
      current += char
      singleQuote = true
      i++
      continue
    }

    if (char === '"') {
      current += char
      doubleQuote = true
      i++
      continue
    }

    if (char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        current += match[0]
        dollarTag = match[0].slice(1, -1)
        i += match[0].length
        continue
      }
    }

    current += char
    if (char === ';') {
      flush()
    }
    i++
  }

  if (current.trim()) {
    flush()
  }

  return statements
}

async function applyCourtSessionsMigration() {
  try {
    console.log('📖 Reading court sessions migration file...')
    const sql = readFileSync('supabase/migrations/20251212_create_court_sessions.sql', 'utf8')

    console.log('🚀 Applying court sessions migration to Supabase...')

    const statements = splitSqlStatements(sql)
      .filter(s => !s.startsWith('--'))

    console.log(`\n📝 Found ${statements.length} SQL statements\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      // Skip comments
      if (statement.startsWith('--')) continue

      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`)
      console.log(statement.substring(0, 100) + '...\n')

      try {
        // Try to execute via fetch to the REST API
        const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ sql: statement })
        })

        if (!result.ok) {
          const errorText = await result.text()
          console.error(`❌ Error executing statement ${i + 1}:`, errorText)
          console.log('\n⚠️  Continuing with next statement...\n')
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message)
        console.log('\n⚠️  Continuing with next statement...\n')
      }
    }

    console.log('\n\n✅ Court sessions migration process completed!')
    console.log('\n📋 Please verify in Supabase Dashboard:')
    console.log('   1. Check that the court_sessions table exists')
    console.log('   2. Check that the get_current_court_session function exists')
    console.log('   3. Test the Troll Court functionality\n')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

applyCourtSessionsMigration()
