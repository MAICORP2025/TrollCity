/**
 * Dynamic Sitemap Generator for Troll City
 * 
 * Generates sitemap-dynamic.xml with URLs for:
 * - User profiles (/profile/:username)
 * - Live streams (/live/:streamId)
 * - Academy courses (/academy/course/:slug)
 * - Agency profiles (/agency/:agencyIdOrSlug)
 * - TCNN articles (/tcnn/article/:id)
 * - Court sessions (/troll-court/watch/:sessionId)
 * - Wall posts (/post/:id)
 * 
 * Run: node scripts/generate-sitemap.mjs
 * 
 * For production, run this as a cron job or build step
 * and upload sitemap-dynamic.xml to /public.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const BASE_URL = process.env.SITEMAP_BASE_URL || 'https://maitrollcity.com'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  console.error('   Example: VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=xxx node scripts/generate-sitemap.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const today = new Date().toISOString().split('T')[0]

/**
 * Escape special XML characters
 */
function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build a single URL entry
 */
function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

const urls = []

// ============================================================
// 1. User Profiles
// ============================================================
console.log('📊 Fetching user profiles...')
try {
  let allProfiles = []
  let from = 0
  const batchSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('username, updated_at, created_at')
      .not('username', 'is', null)
      .neq('username', '')
      .range(from, from + batchSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allProfiles = allProfiles.concat(data)
    if (data.length < batchSize) break
    from += batchSize
  }

  for (const profile of allProfiles) {
    if (profile.username) {
      urls.push(urlEntry(
        `${BASE_URL}/profile/${encodeURIComponent(profile.username)}`,
        (profile.updated_at || profile.created_at || today).split('T')[0],
        'daily',
        '0.9'
      ))
    }
  }
  console.log(`  ✅ ${allProfiles.length} user profiles`)
} catch (err) {
  console.warn(`  ⚠️ Skipping user profiles: ${err.message}`)
}

// ============================================================
// 2. Live Streams (recent and featured)
// ============================================================
console.log('📊 Fetching live streams...')
try {
  // Get streams from the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: streams, error } = await supabase
    .from('streams')
    .select('id, updated_at, created_at')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error

  for (const stream of (streams || [])) {
    urls.push(urlEntry(
      `${BASE_URL}/live/${stream.id}`,
      (stream.updated_at || stream.created_at || today).split('T')[0],
      'hourly',
      '0.9'
    ))
  }
  console.log(`  ✅ ${streams?.length || 0} live streams`)
} catch (err) {
  console.warn(`  ⚠️ Skipping live streams: ${err.message}`)
}

// ============================================================
// 3. Academy Courses
// ============================================================
console.log('📊 Fetching academy courses...')
try {
  const { data: courses, error } = await supabase
    .from('academy_courses')
    .select('slug, updated_at, created_at')
    .eq('is_published', true)
    .not('slug', 'is', null)
  if (error) throw error

  for (const course of (courses || [])) {
    if (course.slug) {
      urls.push(urlEntry(
        `${BASE_URL}/academy/course/${encodeURIComponent(course.slug)}`,
        (course.updated_at || course.created_at || today).split('T')[0],
        'weekly',
        '0.7'
      ))
    }
  }
  console.log(`  ✅ ${courses?.length || 0} academy courses`)
} catch (err) {
  console.warn(`  ⚠️ Skipping academy courses: ${err.message}`)
}

// ============================================================
// 4. Agency Profiles
// ============================================================
console.log('📊 Fetching agency profiles...')
try {
  const { data: agencies, error } = await supabase
    .from('agencies')
    .select('id, slug, updated_at, created_at')
    .eq('is_active', true)
  if (error) throw error

  for (const agency of (agencies || [])) {
    const identifier = agency.slug || agency.id
    if (identifier) {
      urls.push(urlEntry(
        `${BASE_URL}/agency/${encodeURIComponent(identifier)}`,
        (agency.updated_at || agency.created_at || today).split('T')[0],
        'weekly',
        '0.6'
      ))
    }
  }
  console.log(`  ✅ ${agencies?.length || 0} agency profiles`)
} catch (err) {
  console.warn(`  ⚠️ Skipping agency profiles: ${err.message}`)
}

// ============================================================
// 5. TCNN Articles
// ============================================================
console.log('📊 Fetching TCNN articles...')
try {
  const { data: articles, error } = await supabase
    .from('tcnn_articles')
    .select('id, updated_at, created_at, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(5000)
  if (error) throw error

  for (const article of (articles || [])) {
    urls.push(urlEntry(
      `${BASE_URL}/tcnn/article/${article.id}`,
      (article.updated_at || article.published_at || article.created_at || today).split('T')[0],
      'daily',
      '0.7'
    ))
  }
  console.log(`  ✅ ${articles?.length || 0} TCNN articles`)
} catch (err) {
  console.warn(`  ⚠️ Skipping TCNN articles: ${err.message}`)
}

// ============================================================
// 6. Court Sessions (public)
// ============================================================
console.log('📊 Fetching court sessions...')
try {
  const { data: sessions, error } = await supabase
    .from('court_sessions')
    .select('id, updated_at, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error

  for (const session of (sessions || [])) {
    urls.push(urlEntry(
      `${BASE_URL}/troll-court/watch/${session.id}`,
      (session.updated_at || session.created_at || today).split('T')[0],
      'monthly',
      '0.5'
    ))
  }
  console.log(`  ✅ ${sessions?.length || 0} court sessions`)
} catch (err) {
  console.warn(`  ⚠️ Skipping court sessions: ${err.message}`)
}

// ============================================================
// 7. Wall Posts (public)
// ============================================================
console.log('📊 Fetching wall posts...')
try {
  const { data: posts, error } = await supabase
    .from('wall_posts')
    .select('id, updated_at, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error

  for (const post of (posts || [])) {
    urls.push(urlEntry(
      `${BASE_URL}/post/${post.id}`,
      (post.updated_at || post.created_at || today).split('T')[0],
      'weekly',
      '0.5'
    ))
  }
  console.log(`  ✅ ${posts?.length || 0} wall posts`)
} catch (err) {
  console.warn(`  ⚠️ Skipping wall posts: ${err.message}`)
}

// ============================================================
// 8. Troll Battles (public)
// ============================================================
console.log('📊 Fetching troll battles...')
try {
  const { data: battles, error } = await supabase
    .from('troll_battles')
    .select('id, updated_at, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw error

  for (const battle of (battles || [])) {
    urls.push(urlEntry(
      `${BASE_URL}/battle/${battle.id}`,
      (battle.updated_at || battle.created_at || today).split('T')[0],
      'weekly',
      '0.6'
    ))
  }
  console.log(`  ✅ ${battles?.length || 0} troll battles`)
} catch (err) {
  console.warn(`  ⚠️ Skipping troll battles: ${err.message}`)
}

// ============================================================
// Generate sitemap XML
// ============================================================
console.log(`\n📝 Generating sitemap with ${urls.length} URLs...`)

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <!-- ============================================================ -->
  <!-- DYNAMIC SITEMAP - Generated ${today}                          -->
  <!-- ${urls.length} URLs                                           -->
  <!-- ============================================================ -->
${urls.join('\n')}
</urlset>
`

// Write to public directory
const outputPath = join(__dirname, '..', 'public', 'sitemap-dynamic.xml')
writeFileSync(outputPath, sitemap, 'utf-8')

console.log(`\n✅ Sitemap generated: ${outputPath}`)
console.log(`   Total URLs: ${urls.length}`)
console.log(`\n📌 Next steps:`)
console.log(`   1. Verify sitemap-dynamic.xml is in /public`)
console.log(`   2. Submit to Google Search Console`)
console.log(`   3. Set up a cron job to regenerate periodically`)
console.log(`   4. For large sites (>50K URLs), split into multiple sitemap files`)
