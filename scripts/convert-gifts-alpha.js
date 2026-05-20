import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const INPUT_DIR = path.resolve('raw-gift-videos')
const OUTPUT_DIR = path.resolve('public/gift-videos')
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv']

function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' })
    console.log('[convert-gifts-alpha] FFmpeg found')
  } catch {
    console.error('[convert-gifts-alpha] ERROR: FFmpeg not installed. Please install ffmpeg first.')
    process.exit(1)
  }
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`[convert-gifts-alpha] Created output directory: ${OUTPUT_DIR}`)
  }
}

function isVideoFile(filename) {
  return VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase())
}

function slugify(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function convertToWebMAlpha(inputPath, outputPath, overwrite = false) {
  if (fs.existsSync(outputPath) && !overwrite) {
    console.log(`[convert-gifts-alpha] SKIP: ${path.basename(outputPath)} already exists (use --overwrite to replace)`)
    return false
  }

  const cmd = [
    'ffmpeg',
    '-i', `"${inputPath}"`,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0',
    '-y',
    `"${outputPath}"`
  ].join(' ')

  try {
    console.log(`[convert-gifts-alpha] Converting: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`)
    execSync(cmd, { stdio: 'inherit' })
    console.log(`[convert-gifts-alpha] SUCCESS: ${path.basename(outputPath)}`)
    return true
  } catch (err) {
    console.error(`[convert-gifts-alpha] FAILED: ${path.basename(inputPath)}`, err.message)
    return false
  }
}

function main() {
  const args = process.argv.slice(2)
  const overwrite = args.includes('--overwrite')

  checkFFmpeg()
  ensureOutputDir()

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[convert-gifts-alpha] ERROR: Input directory not found: ${INPUT_DIR}`)
    console.log('[convert-gifts-alpha] Create the directory and add video files to process.')
    process.exit(1)
  }

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => isVideoFile(f))

  if (files.length === 0) {
    console.log('[convert-gifts-alpha] No video files found in input directory')
    process.exit(0)
  }

  console.log(`[convert-gifts-alpha] Found ${files.length} video file(s) to process`)

  let converted = 0
  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file)
    const slug = slugify(file)
    const outputPath = path.join(OUTPUT_DIR, `${slug}.webm`)

    if (convertToWebMAlpha(inputPath, outputPath, overwrite)) {
      converted++
    }
  }

  console.log(`[convert-gifts-alpha] Complete: ${converted}/${files.length} files converted`)
}

main()