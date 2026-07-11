import React from 'react'
import { render } from '@testing-library/react'
import GiftVideoOverlay from '../GiftVideoOverlay'

describe('GiftVideoOverlay', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    })

    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: jest.fn(),
    })
  })

  it('renders gift audio and un-mutes the overlay video', () => {
    const gift = {
      id: 'gift-1',
      gift_id: 'heart',
      gift_name: 'Heart',
      gift_slug: 'heart',
      gift_icon: '💖',
      amount: 100,
      quantity: 1,
      sender_id: 'sender-1',
      sender_name: 'Alice',
      created_at: '2026-07-04T00:00:00.000Z',
      animation_url: '/gift-videos/heart.webm',
      video_url: '/gift-videos/heart.webm',
      sound_url: '/sounds/heart.mp3',
      metadata: {},
    }

    const { container } = render(<GiftVideoOverlay gifts={[gift as any]} onFinish={jest.fn()} />)

    const video = container.querySelector('video')
    const audio = container.querySelector('audio')

    expect(video).not.toBeNull()
    expect(video?.hasAttribute('muted')).toBe(false)
    expect(audio).not.toBeNull()
    expect(audio?.getAttribute('src')).toBe('/sounds/heart.mp3')
  })
})
