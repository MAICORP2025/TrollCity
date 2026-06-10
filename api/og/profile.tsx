import { ImageResponse } from '@vercel/og'
import { supabaseAdmin } from '../_shared/auth'

export const runtime = 'edge'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://maitrollcity.com'

async function fetchFont(weight: 'bold' | 'regular' = 'bold'): Promise<ArrayBuffer> {
  const family = weight === 'bold' ? 'Inter:wght@700' : 'Inter:wght@400'
  const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  const cssRes = await fetch(url)
  const css = await cssRes.text()
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)
  if (!match) throw new Error('Font URL not found')
  const fontRes = await fetch(match[1])
  return fontRes.arrayBuffer()
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const username = url.searchParams.get('u') || url.searchParams.get('username')

  if (!username) {
    return new Response('Missing username', { status: 400 })
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, level, role, is_admin, is_broadcaster')
      .eq('username', username)
      .maybeSingle()

    if (error || !profile) {
      return renderFallbackOG(username)
    }

    // Check if user is currently live
    const { data: liveStream } = await supabaseAdmin
      .from('streams')
      .select('id')
      .eq('user_id', profile.id || '')
      .eq('is_live', true)
      .eq('status', 'live')
      .maybeSingle()

    const isLive = !!liveStream
    const displayName = profile.display_name || profile.username || username
    const level = profile.level || 1
    const avatarUrl = profile.avatar_url || null

    const [boldFont, regularFont] = await Promise.all([
      fetchFont('bold'),
      fetchFont('regular'),
    ])

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1035 40%, #2d1b69 100%)',
            fontFamily: 'Inter',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background decorative elements */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, transparent 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '350px',
              height: '350px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(219,39,119,0.25) 0%, transparent 70%)',
            }}
          />

          {/* Grid pattern overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Main content card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              zIndex: 1,
            }}
          >
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                width={140}
                height={140}
                style={{
                  borderRadius: '50%',
                  border: '4px solid rgba(147,51,234,0.6)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #9333ea, #db2777)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '56px',
                  fontWeight: 700,
                  color: 'white',
                  border: '4px solid rgba(147,51,234,0.6)',
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name */}
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: 'white',
                textAlign: 'center',
                maxWidth: '900px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>

            {/* Level + Live badge row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Level badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(147,51,234,0.2)',
                  border: '1px solid rgba(147,51,234,0.5)',
                  borderRadius: '9999px',
                  padding: '8px 20px',
                }}
              >
                <span style={{ fontSize: '20px', color: '#c084fc', fontWeight: 700 }}>
                  Level {level}
                </span>
              </div>

              {/* Live badge */}
              {isLive && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.6)',
                    borderRadius: '9999px',
                    padding: '8px 20px',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#ef4444',
                    }}
                  />
                  <span style={{ fontSize: '20px', color: '#fca5a5', fontWeight: 700 }}>
                    Live Now
                  </span>
                </div>
              )}
            </div>

            {/* Troll City branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #9333ea, #db2777)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '18px' }}>👁</span>
              </div>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #9333ea, #db2777)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Troll City
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Inter', data: boldFont, weight: 700, style: 'normal' },
          { name: 'Inter', data: regularFont, weight: 400, style: 'normal' },
        ],
      }
    )
  } catch (err) {
    console.error('[OG Profile] Error:', err)
    return renderFallbackOG(username)
  }
}

function renderFallbackOG(username: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1035 40%, #2d1b69 100%)',
          fontFamily: 'Inter',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '52px', fontWeight: 700, color: 'white' }}>{username}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #9333ea, #db2777)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '18px' }}>👁</span>
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #9333ea, #db2777)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Troll City
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
