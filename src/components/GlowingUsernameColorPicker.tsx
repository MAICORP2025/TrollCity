import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { toast } from 'sonner'
import { GLOWING_USERNAME_COLORS, saveGlowingUsernameColor, getGlowingUsernameColor } from '../lib/glowingUsernameSystem'

interface GlowingUsernameColorPickerProps {
  userId: string
  onColorSelected?: (color: string) => void
  compact?: boolean
}

export function GlowingUsernameColorPicker({
  userId,
  onColorSelected,
  compact = false
}: GlowingUsernameColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadCurrentColor = useCallback(async () => {
    try {
      setLoading(true)
      const color = await getGlowingUsernameColor(userId)
      setSelectedColor(color || GLOWING_USERNAME_COLORS[0].value)
    } catch {
      console.error('Error loading current color')
      setSelectedColor(GLOWING_USERNAME_COLORS[0].value)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadCurrentColor()
  }, [loadCurrentColor])

  const handleColorSelect = async (color: string) => {
    setSelectedColor(color)
    setSaving(true)

    try {
      const result = await saveGlowingUsernameColor(userId, color)
      if (result.success) {
        toast.success('Username glow color updated!')
        onColorSelected?.(color)
      } else {
        toast.error(result.error || 'Failed to save color')
        setSelectedColor(selectedColor) // Revert
      }
    } catch {
      toast.error('Error saving color')
      setSelectedColor(selectedColor) // Revert
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400">Loading colors...</div>
  }

  return (
    <div className={`space-y-3 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <h3 className="font-semibold text-white">Glowing Username Color</h3>
      </div>
      <p className="text-xs text-gray-400">Choose your favorite color for your glowing username effect</p>
      
      <div className={`grid ${compact ? 'grid-cols-5' : 'grid-cols-4'} gap-2`}>
        {GLOWING_USERNAME_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => handleColorSelect(color.value)}
            disabled={saving}
            className={`relative p-3 rounded-lg border-2 transition-all ${
              selectedColor === color.value
                ? 'border-white shadow-lg'
                : 'border-gray-700 hover:border-gray-500'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={color.name}
            style={{ backgroundColor: color.value }}
          >
            {selectedColor === color.value && (
              <Check className="w-4 h-4 text-white absolute top-1 right-1" />
            )}
            {!compact && (
              <span className="text-xs font-semibold text-white drop-shadow-lg">
                {color.name}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        className="p-2 rounded border border-yellow-500/30 bg-yellow-900/10"
        style={{
          color: selectedColor || '#FFD700',
          textShadow: `0 0 10px ${selectedColor || '#FFD700'}, 0 0 20px ${selectedColor || '#FFD700'}`
        }}
      >
        <p className="font-bold text-center">Preview: Your Glowing Username</p>
      </div>
    </div>
  )
}
