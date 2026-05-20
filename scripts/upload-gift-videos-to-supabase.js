import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const INPUT_DIR = path.resolve('public/gift-videos')
const VIDEO_EXTENSIONS = ['.webm']

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[upload-gift-videos] ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const STORAGE_BUCKET = 'gift-videos'

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find(b => b.name === STORAGE_BUCKET)) {
    console.log(`[upload-gift-videos] Creating bucket: ${STORAGE_BUCKET}`)
    const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      allowedMimeTypes: ['video/webm'],
      fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
    })
    if (error) {
      console.error(`[upload-gift-videos] Failed to create bucket:`, error.message)
      process.exit(1)
    }
    console.log(`[upload-gift-videos] Created bucket: ${STORAGE_BUCKET}`)
  }
}

function slugify(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uploadFile(filePath, slug) {
  const fileBuffer = fs.readFileSync(filePath)
  const fileName = `${slug}.webm`

  console.log(`[upload-gift-videos] Uploading: ${fileName}`)

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: 'video/webm',
      upsert: true,
    })

  if (error) {
    console.error(`[upload-gift-videos] Upload failed for ${fileName}:`, error.message)
    return null
  }

  console.log(`[upload-gift-videos] Uploaded: ${fileName}`)
  return fileName
}

async function getPublicUrl(fileName) {
  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

async function updateGiftItem(slug, animationUrl) {
  const { data, error } = await supabaseAdmin
    .from('gift_items')
    .update({ animation_url: animationUrl })
    .eq('slug', slug)
    .select()

  if (error) {
    console.error(`[upload-gift-videos] DB update failed for slug "${slug}":`, error.message)
    return false
  }

  if (!data || data.length === 0) {
    console.warn(`[upload-gift-videos] No gift_items row found for slug: ${slug}`)
    return false
  }

  console.log(`[upload-gift-videos] Updated gift_items: ${slug}`)
  return true
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  await ensureBucket()

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[upload-gift-videos] ERROR: Input directory not found: ${INPUT_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))

  if (files.length === 0) {
    console.log('[upload-gift-videos] No .webm files found in input directory')
    process.exit(0)
  }

  console.log(`[upload-gift-videos] Found ${files.length} file(s) to process`)

  let success = 0
  let failed = 0

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file)
    const slug = slugify(file)

    if (dryRun) {
      console.log(`[upload-gift-videos] DRY RUN: Would process ${file} (slug: ${slug})`)
      continue
    }

    const uploadedFileName = await uploadFile(filePath, slug)
    if (!uploadedFileName) {
      failed++
      continue
    }

    const publicUrl = await getPublicUrl(uploadedFileName)
    if (!publicUrl) {
      console.error(`[upload-gift-videos] Could not get public URL for ${uploadedFileName}`)
      failed++
      continue
    }

    const updated = await updateGiftItem(slug, publicUrl)
    if (updated) {
      success++
    } else {
      failed++
    }
  }

  console.log(`[upload-gift-videos] Complete: ${success} succeeded, ${failed} failed`)
}

main().catch(err => {
  console.error('[upload-gift-videos] Fatal error:', err)
  process.exit(1)
})