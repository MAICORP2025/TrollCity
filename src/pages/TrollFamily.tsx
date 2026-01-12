// src/pages/TrollFamily.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TrollFamily() {
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect to the family browse list
    navigate('/family/browse', { replace: true })
  }, [navigate])

  return null
}
