import React from 'react'

const VideoPlayer = ({ videoSrc }) => {
  return (
    <div>
      <h2>Video Player</h2>
      {/* Placeholder for video player logic from supabase*/}
      <video controls src={videoSrc} />
    </div>
  )
}

export default VideoPlayer