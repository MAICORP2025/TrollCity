// src/pages/TrollFamily.tsx
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TrollFamily() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect to the new family lounge
    navigate('/family/lounge', { replace: true })
  }, [navigate])

  return null
}
