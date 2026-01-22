# TrollCity Mobile Broadcast Redesign - Complete Implementation

> **Status**: ✅ Design & Components Complete | Ready for Integration
> 
> **Version**: 1.0  
> **Date**: January 2026  
> **Target**: Web & PWA (Android/iOS via Capacitor)

---

## 📋 Quick Overview

This redesign transforms your broadcast/live screen into a modern, touch-first mobile experience inspired by **TikTok Live** and **Bigo Live** while maintaining **TrollCity's neon purple/pink identity**.

### What Changed

| Area | Before | After |
|------|--------|-------|
| **Layout** | Cluttered desktop-first | Clean mobile-first |
| **Top Bar** | Overloaded with buttons | Minimal (Live badge + timer + viewer count + menu) |
| **Chat** | Fixed huge panel | Bottom sheet (TikTok pattern) |
| **Participants** | Empty placeholder boxes | Only active participants shown |
| **Controls** | Scattered all over | Floating cluster (right side) |
| **Bottom Nav** | Competes with live | Hidden during broadcast |
| **Glow** | Excessive everywhere | Only on active/selected elements |
| **Tap Targets** | Too small (< 44px) | 44-56px minimum |

---

## 📁 New Files Created

### Components (Ready to Use)

```
src/components/broadcast/
├── TopLiveBar.tsx              ✅ Minimal top controls
├── FloatingActionCluster.tsx   ✅ Mic, camera, flip, effects buttons
├── ParticipantStrip.tsx        ✅ Only active participants (no empty slots)
├── ChatBottomSheet.tsx         ✅ TikTok-style chat sheet
├── MoreControlsDrawer.tsx      ✅ Settings & advanced controls
└── MobileBroadcastLayout.tsx   ✅ Main container (orchestrates all)
```

### Styling

```
src/styles/
└── mobile-broadcast.css        ✅ Complete breakpoint system + safe areas
```

### Documentation

```
├── MOBILE_BROADCAST_INTEGRATION.md  ✅ Integration guide + examples
├── MOBILE_BROADCAST_IMPLEMENTATION.md (this file)
└── (existing) MOBILE_UNIFICATION_SUMMARY.md
```

---

## 🎨 Design System

### Colors (TrollCity Identity)

```css
--troll-dark-bg: #06030e;      /* Dark navy base */
--troll-dark-card: #11081e;    /* Slightly lighter for contrast */
--troll-gold: #ff5adf;         /* Neon pink */
--troll-cyan: #3ad7ff;         /* Neon cyan (accent) */
--troll-white: #E2E2E2;        /* Soft white */

/* Purple/Lavender palette for controls */
rgba(167, 139, 250, 0.1)   /* Light purple background */
rgba(167, 139, 250, 0.3)   /* Medium purple border */
rgba(167, 139, 250, 0.6)   /* Strong purple on active */
rgba(196, 181, 253, 0.95)  /* Lavender text */
```

### Typography

- Font: `Inter` (already in your stack)
- Sizes: 11px (xs) → 22px (buttons)
- Weights: 500 (normal), 600 (semibold), 700 (bold)

### Spacing & Rhythm

- Tap target minimum: **44px**
- Gap between elements: **8-12px**
- Padding: **8-12px** (increased on larger devices)

### Shadows & Glow

- **Subtle shadow** (non-active): `0 2px 8px rgba(0, 0, 0, 0.3)`
- **Glow (active only)**: `0 0 12px rgba(167, 139, 250, 0.4)`
- **No stacked glows** - only one element glows at a time

---

## 📐 Responsive Breakpoints

### CSS Media Queries (Mobile-First)

```css
/* xs: <= 360px (tiny phones like iPhone SE) */
@media (max-width: 360px) { ... }

/* sm: 361px–480px (standard phones) */
@media (min-width: 361px) and (max-width: 480px) { ... }

/* md: 481px–768px (large phones / small tablets) */
@media (min-width: 481px) and (max-width: 768px) { ... }

/* lg: 769px–1024px (tablets) */
@media (min-width: 769px) and (max-width: 1024px) { ... }

/* desktop: >= 1025px */
@media (min-width: 1025px) { ... }
```

### Behavioral Changes

| Breakpoint | Top Bar | Actions | Participants | Chat | Notes |
|-----------|---------|---------|--------------|------|-------|
| xs/sm (≤480px) | Minimal | 44px circles | Hidden | Bottom sheet | Focused experience |
| md (481-768px) | Minimal | 48px circles | Visible | Bottom sheet | Comfortable touch |
| lg (769-1024px) | Minimal | 52px circles | Visible | Bottom sheet | Tablet layout |
| desktop (1025px+) | Desktop | Desktop layout | Desktop | Desktop | Original layout |

### Safe Area Handling

All overlay elements use `env(safe-area-inset-*)`:

```css
padding-top: env(safe-area-inset-top);        /* Notch / status bar */
padding-bottom: env(safe-area-inset-bottom);  /* Home indicator */
padding-left: env(safe-area-inset-left);      /* Side notch */
padding-right: env(safe-area-inset-right);    /* Side notch */
```

This ensures content is visible on:
- iPhone with notch/Dynamic Island
- Android with notch
- iPad with home indicator
- Foldable devices

---

## 🏗️ Layout Architecture

### Mobile Container Structure

```
┌─ broadcast-mobile-container ──────────────────────┐
│                                                   │
│  ┌─ broadcast-video-stage ────────────────────┐  │
│  │                                            │  │
│  │  ┌─ broadcast-video-container ───────┐   │  │
│  │  │   Your video/stream goes here   │   │  │
│  │  └────────────────────────────────┘   │  │
│  │                                        │  │
│  │  ┌─ broadcast-top-bar ─────────────┐  │  │
│  │  │ [🔴 LIVE 00:01:17] [👁 1.2K] [⋮]│  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                        │  │
│  │  ┌─ broadcast-floating-cluster ────┐  │  │
│  │  │ 🎤  (Mic)                      │  │  │
│  │  │ 📷  (Camera)                   │  │  │
│  │  │ 🔄  (Flip)                     │  │  │
│  │  │ ✨  (Effects)                  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                        │  │
│  │  ┌─ broadcast-participant-strip ──┐  │  │
│  │  │ [👤] [👤] [👤] [+ Invite]  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ┌─ broadcast-chat-bar ──────────────────────┐  │
│  │ 💬 Tap to chat                        [→]  │  │
│  └───────────────────────────────────────────┘  │
│                                                   │
└───────────────────────────────────────────────┘

┌─ broadcast-chat-sheet (when expanded) ────┐
│ ──────────────────────────────────────── │
│ Chat Messages                          [X]│
│ ...                                      │
│ ...                                      │
│ ─────────────────────────────────────── │
│ [Input field...........................] [↑]│
└─────────────────────────────────────────┘

┌─ broadcast-drawer (More Menu) ─────┐
│ Controls                          [X]│
│ ┌ Flying Chats          [Toggle]  │
│ ┌ Battles                [Toggle]  │
│ ┌ Add Guest                        │
│ ──────────────────────────────     │
│ THEME                              │
│ [💜 Purple] [⚡ Neon] [🌈 RGB]   │
│ ──────────────────────────────     │
│ ┌ Broadcast Settings              │
│ ...                                │
└──────────────────────────────────┘
```

---

## 🎯 Component Reference

### 1. TopLiveBar

**Location**: `src/components/broadcast/TopLiveBar.tsx`

**Props**:
```typescript
{
  isLive: boolean;              // Is broadcast live?
  timer: string;                // Format: "00:01:17"
  viewerCount: number;          // e.g., 1234
  onMoreClick: () => void;      // Open drawer
  className?: string;           // Extra CSS classes
}
```

**Usage**:
```tsx
<TopLiveBar
  isLive={true}
  timer="00:02:45"
  viewerCount={1500}
  onMoreClick={() => setDrawerOpen(true)}
/>
```

**Never wraps** on mobile; if too many items, it still fits because only:
- Live badge + timer
- Viewer count
- More button (⋮)

---

### 2. FloatingActionCluster

**Location**: `src/components/broadcast/FloatingActionCluster.tsx`

**Props**:
```typescript
{
  isMuted: boolean;
  onToggleMic: () => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEffectsClick: () => void;
  className?: string;
}
```

**Visual States**:
- **Inactive**: Dark background, subtle border
- **Active**: Purple glow (`box-shadow: 0 0 12px rgba(167, 139, 250, 0.4)`)
- **Danger** (muted/camera off): Red background + glow

**Note**: Buttons are **circular** (border-radius: 50%) with **44-56px** size (touch-friendly).

---

### 3. ParticipantStrip

**Location**: `src/components/broadcast/ParticipantStrip.tsx`

**Props**:
```typescript
{
  participants: Participant[];  // Only active participants
  onInviteClick: () => void;    // Invite guest button
  onParticipantClick?: (p: Participant) => void;
  className?: string;
}
```

**Key Behavior**:
- Shows **only active participants** (no empty placeholder boxes)
- If no participants: Shows "+ Invite Guest" button
- Horizontally scrollable if > 3 participants
- Each tile is 56x56px (md+: 64x64px)

---

### 4. ChatBottomSheet

**Location**: `src/components/broadcast/ChatBottomSheet.tsx`

**Props**:
```typescript
{
  isOpen: boolean;
  messages: Message[];          // Array of chat messages
  unreadCount?: number;         // Unread badge count
  onSendMessage: (content: string) => void;
  onClose: () => void;          // Close sheet
  className?: string;
}
```

**Features**:
- ✅ Expands from bottom
- ✅ Drag handle at top
- ✅ Message list with auto-scroll
- ✅ Auto-growing textarea (1-3 rows)
- ✅ Send button with Enter key support (Shift+Enter for new line)
- ✅ Smooth animations

---

### 5. MoreControlsDrawer

**Location**: `src/components/broadcast/MoreControlsDrawer.tsx`

**Props**:
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  config: MoreControlsConfig;   // { showFlyingChats, enableBattles, theme }
  onFlyingChatsToggle: (enabled: boolean) => void;
  onBattlesToggle: (enabled: boolean) => void;
  onAddGuest: () => void;
  onSettings: () => void;
  onThemeChange: (theme: 'purple' | 'neon' | 'rgb') => void;
  className?: string;
}
```

**Items**:
1. Flying Chats (toggle)
2. Battles (toggle)
3. Add Guest (button)
4. Theme Selector (purple/neon/rgb)
5. Broadcast Settings (button)

---

### 6. MobileBroadcastLayout (Main Container)

**Location**: `src/components/broadcast/MobileBroadcastLayout.tsx`

**Props**:
```typescript
{
  room: Room;                   // LiveKit room
  isLive: boolean;
  timer: string;
  viewerCount: number;
  isMuted: boolean;
  isCameraOn: boolean;
  messages: Message[];
  participants: Participant[];
  unreadChatCount?: number;
  videoContainerRef?: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;  // Your video element
  // Callbacks
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEffectsClick: () => void;
  onInviteGuest: () => void;
  onParticipantClick?: (p: Participant) => void;
  onSendMessage: (content: string) => void;
  onFlyingChatsToggle?: (enabled: boolean) => void;
  onBattlesToggle?: (enabled: boolean) => void;
  onAddGuest?: () => void;
  onBroadcastSettings?: () => void;
  onThemeChange?: (theme: 'purple' | 'neon' | 'rgb') => void;
  className?: string;
}
```

**Orchestrates**: All child components + state management for chat/drawer.

---

## 🔧 Integration Steps

### Step 1: Import in LivePage

```typescript
import MobileBroadcastLayout from '../components/broadcast/MobileBroadcastLayout';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';
import { useMobileBreakpoint, useLiveTimer } from './hooks';

export default function LivePage() {
  const { isMobile } = useMobileBreakpoint();
  // ... rest of your code
}
```

### Step 2: Add Responsive Detection

```typescript
const { isMobile } = useMobileBreakpoint();
const timer = useLiveTimer(startTime, isLive);
```

### Step 3: Conditional Rendering

```typescript
if (isMobile) {
  return (
    <MobileBroadcastLayout
      room={room}
      isLive={isLive}
      timer={timer}
      viewerCount={viewerCount}
      isMuted={isMuted}
      isCameraOn={isCameraOn}
      messages={messages}
      participants={activeParticipants}
      onToggleMic={handleToggleMic}
      onToggleCamera={handleToggleCamera}
      onFlipCamera={handleFlipCamera}
      onEffectsClick={handleEffectsClick}
      onInviteGuest={handleInviteGuest}
      onSendMessage={handleSendMessage}
      onFlyingChatsToggle={handleFlyingChatsToggle}
      onBattlesToggle={handleBattlesToggle}
      onThemeChange={handleThemeChange}
    >
      {/* Your video element */}
      <video ref={videoRef} />
    </MobileBroadcastLayout>
  );
}

// Desktop layout unchanged
return <BroadcastLayout ... />;
```

### Step 4: Wire Up Callbacks

All callback props are required. If you don't have implementations yet, use stubs:

```typescript
const handleToggleMic = useCallback(() => {
  // TODO: Toggle mic in LiveKit
  console.log('Toggle mic');
}, []);
```

### Step 5: Test

1. Run `npm run dev`
2. Open DevTools (F12)
3. Enable Device Emulation
4. Test on:
   - iPhone 12 (390x844)
   - iPhone SE (375x667)
   - Pixel 5 (393x851)
   - iPad (768x1024)
   - Desktop (1440x900)

---

## ✅ Implementation Checklist

### Layout & CSS
- [x] `mobile-broadcast.css` created with all breakpoints
- [x] Safe area variables used throughout
- [x] No horizontal scrolling on mobile
- [x] Tap targets >= 44px
- [x] Glow only on active elements

### Components
- [x] TopLiveBar (minimal top bar)
- [x] FloatingActionCluster (right-side buttons)
- [x] ParticipantStrip (only active participants)
- [x] ChatBottomSheet (TikTok-style sheet)
- [x] MoreControlsDrawer (settings drawer)
- [x] MobileBroadcastLayout (main container)

### Styling Details
- [x] TrollCity colors preserved (dark navy, neon purple/pink)
- [x] Typography clean and readable
- [x] Animations smooth (slide-up, fade-in)
- [x] Bottom nav suppression during live

### Missing (TODO in Your Implementation)
- [ ] Integrate with your real message data
- [ ] Integrate with your real participant data
- [ ] Implement actual mic/camera toggle (LiveKit)
- [ ] Implement actual message sending (Supabase)
- [ ] Implement effects menu
- [ ] Implement add guest modal
- [ ] Real-time viewer count updates
- [ ] Theme persistence
- [ ] Message persistence (real-time sync)

---

## 🎨 CSS Custom Properties

All colors use CSS variables for easy theming. Located in `src/index.css`:

```css
:root {
  --troll-dark-bg: #06030e;
  --troll-dark-card: #11081e;
  --troll-gold: #ff5adf;
  --troll-cyan: #3ad7ff;
  --troll-white: #E2E2E2;
  
  /* More specific colors added in mobile-broadcast.css */
}
```

To change the theme globally, just update `:root` variables.

---

## 📱 Mobile-Specific Features

### 1. Safe Area Support
- Notched iPhone: Automatic top padding
- Home indicator: Automatic bottom padding
- Foldable: Left/right padding respected

### 2. Gesture Handling
- Swipe down to close chat sheet
- Tap outside to close drawer
- Keyboard management (input auto-focus)

### 3. Performance
- Hardware-accelerated animations (CSS transforms)
- Scrollable areas use `-webkit-overflow-scrolling: touch`
- Minimal repaints on scroll

### 4. Orientation Handling
- Portrait: Full mobile layout
- Landscape: Still mobile layout (smaller, but consistent)
- Rotation: Smooth transition (no layout shift)

---

## 🚀 Deployment

### Web (Vercel)
```bash
npm run build:web
git push origin main
# Auto-deploys via Vercel
```

### PWA (Capacitor)
```bash
npm run cap:sync:android
cd android
./gradlew bundleRelease
# Upload to Google Play
```

### iOS (Future)
```bash
npm run cap:add:ios
npm run cap:sync:ios
cd ios
# Open in Xcode, build and deploy
```

---

## 📊 Metrics

### Performance Targets
- First Paint: < 1s
- Interactive: < 2s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

### Mobile Friendliness
- ✅ 44px+ tap targets
- ✅ Mobile-optimized viewport
- ✅ Touch-friendly spacing
- ✅ Fast CSS animations
- ✅ Minimal JavaScript

---

## 🐛 Troubleshooting

### Chat Sheet Not Expanding?
- Check `.broadcast-chat-sheet` z-index (should be 40)
- Verify overlay clicked to trigger `isOpen`

### Buttons Too Small?
- Check actual device screen size
- DevTools might show scaled size differently
- Test on real device

### Safe Area Not Showing?
- Requires PWA/native app context
- In browser, notch not simulated
- Use real iPhone/Android device to test

### Bottom Nav Not Hiding?
- Check selector `.broadcast-mobile-layout-active .bottom-nav`
- Adjust class name to match your nav component

---

## 🎓 Resources

- [MDN: Safe Area Insets](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [CSS Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [TikTok Live UI Patterns](https://twitter.com/search?q=tiktok+live)
- [TrollCity Existing Styles](src/index.css)

---

## 💡 Future Enhancements

1. **Gesture Recognition**: Swipe to switch between tabs
2. **Dark Mode**: Automatic system preference detection
3. **Haptics**: Vibration on button clicks (requires Capacitor)
4. **Picture-in-Picture**: Minimize video to corner
5. **Screen Recording**: Share screen during broadcast
6. **Overlay Customization**: User-adjustable UI positions
7. **Analytics**: Track broadcast metrics in real-time
8. **Accessibility**: Full keyboard navigation + screen reader

---

## 📞 Support

For issues or questions:
1. Check `MOBILE_BROADCAST_INTEGRATION.md` for examples
2. Review component prop types in source files
3. Test on real mobile device (emulator != reality)
4. Check browser console for errors

---

**Last Updated**: January 2026  
**Status**: Ready for Integration  
**Contributors**: TrollCity Engineering
