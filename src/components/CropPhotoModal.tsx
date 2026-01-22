import React from 'react'
import { X } from 'lucide-react'

interface CropPhotoModalProps {
  isOpen: boolean
  imageFile: File | null
  onCrop: (croppedFile: File) => void
  onCancel: () => void
  aspectRatio?: number
  title?: string
}

const CropPhotoModal: React.FC<CropPhotoModalProps> = ({
  isOpen,
  imageFile,
  onCrop,
  onCancel,
  aspectRatio = 16 / 9,
  title = 'Crop Photo'
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [imageSrc, setImageSrc] = React.useState<string>('')
  const [scale, setScale] = React.useState(1)
  const [offsetX, setOffsetX] = React.useState(0)
  const [offsetY, setOffsetY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })

  // Load image
  React.useEffect(() => {
    if (imageFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string)
      }
      reader.readAsDataURL(imageFile)
    }
  }, [imageFile])

  const handleImageLoad = () => {
    if (imageRef.current) {
      const img = imageRef.current
      const containerWidth = 400
      const containerHeight = containerWidth / aspectRatio

      // Calculate initial scale to fit container
      const scaleX = containerWidth / img.naturalWidth
      const scaleY = containerHeight / img.naturalHeight
      const newScale = Math.max(scaleX, scaleY)

      setScale(newScale)
      setOffsetX(0)
      setOffsetY(0)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return

    const img = imageRef.current
    const containerWidth = 400
    const containerHeight = containerWidth / aspectRatio

    const scaledWidth = img.naturalWidth * scale
    const scaledHeight = img.naturalHeight * scale

    let newX = e.clientX - dragStart.x
    let newY = e.clientY - dragStart.y

    // Constrain movement
    newX = Math.min(0, Math.max(newX, containerWidth - scaledWidth))
    newY = Math.min(0, Math.max(newY, containerHeight - scaledHeight))

    setOffsetX(newX)
    setOffsetY(newY)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScale(parseFloat(e.target.value))
  }

  const handleCrop = () => {
    if (!canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const containerWidth = 400
    const containerHeight = containerWidth / aspectRatio

    canvas.width = containerWidth
    canvas.height = containerHeight

    const img = imageRef.current
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, containerWidth, containerHeight)

    ctx.drawImage(
      img,
      offsetX,
      offsetY,
      img.naturalWidth * scale,
      img.naturalHeight * scale
    )

    canvas.toBlob((blob) => {
      if (blob && imageFile) {
        const croppedFile = new File([blob], imageFile.name, {
          type: 'image/jpeg',
          lastModified: Date.now()
        })
        onCrop(croppedFile)
      }
    }, 'image/jpeg', 0.95)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-2xl border border-[#2C2C2C] max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2C]">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Crop Preview */}
          <div
            className="relative bg-black rounded-lg overflow-hidden border border-[#2C2C2C]"
            style={{
              width: '400px',
              height: `${400 / aspectRatio}px`,
              margin: '0 auto'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Preview"
                onLoad={handleImageLoad}
                style={{
                  position: 'absolute',
                  transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transformOrigin: '0 0'
                }}
                draggable={false}
              />
            )}
          </div>

          {/* Zoom Control */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Zoom</label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Fit</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={handleZoom}
                className="flex-1 h-2 bg-[#2C2C2C] rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400">Max</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Drag to reposition • Use slider to zoom</p>
          </div>

          {/* Hidden canvas for cropping */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-[#2C2C2C]">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-[#2C2C2C] text-white hover:bg-[#3C3C3C] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white hover:from-[#8B4FF4] hover:to-[#B59CFF] transition"
            >
              Crop & Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CropPhotoModal
