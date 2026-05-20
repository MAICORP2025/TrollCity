import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const INPUT_DIR = path.resolve('raw-gift-videos')
const OUTPUT_DIR = path.resolve('public/gift-videos')
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv']

const DEFAULT_CHROMA_KEY = {
  color: '0x00ff00',
  similarity: 0.2,
  blend: 0.0
}

function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' })
    console.log('[convert-gifts-greenscreen] FFmpeg found')
  } catch {
    console.error('[convert-gifts-greenscreen] ERROR: FFmpeg not installed. Please install ffmpeg first.')
    process.exit(1)
  }
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`[convert-gifts-greenscreen] Created output directory: ${OUTPUT_DIR}`)
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

function convertToWebMGreenscreen(inputPath, outputPath, chromaKey, overwrite = false) {
  if (fs.existsSync(outputPath) && !overwrite) {
    console.log(`[convert-gifts-greenscreen] SKIP: ${path.basename(outputPath)} already exists (use --overwrite to replace)`)
    return false
  }

  const { color, similarity, blend } = chromaKey

  const cmd = [
    'ffmpeg',
    '-i', `"${inputPath}"`,
    '-vf', `chromakey=0x${color.toString(16)}:0.${Math.round(similarity * 100)}:0.${Math.round(blend * 100)},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0',
    '-y',
    `"${outputPath}"`
  ].join(' ')

  try {
    console.log(`[convert-gifts-greenscreen] Converting: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`)
    execSync(cmd, { stdio: 'inherit' })
    console.log(`[convert-gifts-greenscreen] SUCCESS: ${path.basename(outputPath)}`)
    return true
  } catch (err) {
    console.error(`[convert-gifts-greenscreen] FAILED: ${path.basename(inputPath)}`, err.message)
    return false
  }
}

function parseArg(arg, defaultValue) {
  const idx = process.argv.indexOf(arg)
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }
  return defaultValue
}

function main() {
  const args = process.argv.slice(2)
  const overwrite = args.includes('--overwrite')

  const colorArg = parseArg('--color', DEFAULT_CHROMA_KEY.color)
  const similarityArg = parseFloat(parseArg('--similarity', DEFAULT_CHROMA_KEY.similarity)) || DEFAULT_CHROMA_KEY.similarity
  const blendArg = parseFloat(parseArg('--blend', DEFAULT_CHROMA_KEY.blend)) || DEFAULT_CHROMA_KEY.blend

  const chromaKey = {
    color: parseInt(colorArg.replace('#', ''), 16) || DEFAULT_CHROMA_KEY.color,
    similarity: similarityArg,
    blend: blendArg
  }

  checkFFmpeg()
  ensureOutputDir()

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[convert-gifts-greenscreen] ERROR: Input directory not found: ${INPUT_DIR}`)
    console.log('[convert-gifts-greenscreen] Create the directory and add video files to process.')
    process.exit(1)
  }

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => isVideoFile(f))

  if (files.length === 0) {
    console.log('[convert-gifts-greenscreen] No video files found in input directory')
    process.exit(0)
  }

  console.log(`[convert-gifts-greenscreen] Found ${files.length} video file(s) to process`)
  console.log(`[convert-gifts-greenscreen] Chroma key: color=#${chromaKey.color.toString(16)}, similarity=${chromaKey.similarity}, blend=${chromaKey.blend}`)

  let converted = 0
  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file)
    const slug = slugify(file)
    const outputPath = path.join(OUTPUT_DIR, `${slug}.webm`)

    if (convertToWebMGreenscreen(inputPath, outputPath, chromaKey, overwrite)) {
      converted++
    }
  }

  console.log(`[convert-gifts-greenscreen] Complete: ${converted}/${files.length} files converted`)
}

main()