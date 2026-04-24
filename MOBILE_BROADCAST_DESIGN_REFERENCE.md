# Mobile Broadcast Design Reference

## 📱 Visual Wireframes & Design System

---

## 1. PORTRAIT LAYOUT (Primary - all phones)

### FULL VIEW (Video + Controls)

```
┌─────────────────────────────────────┐
│ 👤 safe-area-top                    │  ← iPhone notch/status bar
├─────────────────────────────────────┤
│                                     │
│  [🔴 LIVE 00:01:17]  [👁 1.2K] [⋮]│  ← TopLiveBar
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║                               ║ │
│  ║    YOUR VIDEO STREAM HERE     ║ │  ← Video Stage (100% flex)
│  ║                               ║ │
│  ║  + FloatingActionCluster      ║ │  ← Right side:
│  ║    🎤 (Mic)                   ║ │     • 🎤 Mic
│  ║    📷 (Camera)                ║ │     • 📷 Camera
│  ║    🔄 (Flip)                  ║ │     • 🔄 Flip
│  ║    ✨ (Effects)               ║ │     • ✨ Effects
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  [👤] [👤] [👤] [+ Invite]        │  ← ParticipantStrip (md+)
│                                     │
├─────────────────────────────────────┤
│ 💬 Tap to chat                   [→]│  ← ChatBar (collapsed)
├─────────────────────────────────────┤
│ 👤 safe-area-bottom                 │  ← Home indicator/edge
└─────────────────────────────────────┘
```

### CHAT SHEET (When user taps chat bar)

```
┌─────────────────────────────────────┐
│ 🌫️ Dim overlay (tap to close)       │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ──────────────────────────────  ││  ← Drag handle
│  ├─────────────────────────────────┤│
│  │ Chat                          [X]││  ← Header
│  ├─────────────────────────────────┤│
│  │                                 ││
│  │ TrollMaster: Great stream! 🎉  ││
│  │                                 ││
│  │ Queen: Love it! 💖              ││
│  │                                 ││
│  │ King: When's the next one?     ││
│  │                                 ││
│  ├─────────────────────────────────┤│
│  │ [Type a message...] [Send ↑]   ││  ← Input area
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### MORE CONTROLS DRAWER (When user taps ⋮)

```
┌─────────────────────────────────────┐
│ 🌫️ Dim overlay (tap to close)       │
│         ┌─────────────────────────┐ │
│         │ Controls             [X]│ │  ← Header
│         ├─────────────────────────┤ │
│         │                         │ │
│         │ ☐ Flying Chats [Toggle]│ │
│         │                         │ │
│         │ ☐ Battles      [Toggle]│ │
│         │                         │ │
│         │ ► Add Guest            │ │
│         │                         │ │
│         │ ─────────────────────  │ │  ← Divider
│         │                         │ │
│         │ THEME                   │ │
│         │ [💜] [⚡] [🌈]        │ │  ← Purple/Neon/RGB
│         │                         │ │
│         │ ─────────────────────  │ │  ← Divider
│         │                         │ │
│         │ ► Broadcast Settings   │ │
│         │                         │ │
│         │ 💡 Tips                 │ │
│         │ • Use Flying Chats      │ │
│         │ • Enable Battles        │ │
│         │ • Change themes         │ │
│         │                         │ │
│         └─────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. COMPONENT SPACING & DIMENSIONS

### TopLiveBar

```
Height: 44px (including padding)

[4px][🔴 LIVE 00:01:17][4px]  [viewer-count][4px]  [⋮-button][8px]
|------|                       |-------|             |------|
  min                            min                   36px
```

- Min tap target: 36px (⋮ button)
- Gaps: 4-8px between elements
- NO wrap on mobile (items compress, not wrap)

### FloatingActionCluster

```
Width: 48px (+ 8px padding)
Gap: 12px between buttons

┌────────┐
│  🎤    │  48px
│  44px  │
└────────┘ 8px gap

┌────────┐
│  📷    │  48px
│  44px  │
└────────┘ 8px gap

┌────────┐
│  🔄    │  48px
│  44px  │
└────────┘ 8px gap

┌────────┐
│  ✨    │  48px
│  44px  │
└────────┘

Position: 8px from right edge, 80px+ from bottom
On sm: 44px buttons
On md+: 48-52px buttons
```

### ParticipantStrip

```
Height: 72px (56px tile + 8px padding top/bottom)

On sm: HIDDEN (visibility: hidden; height: 0)
On md+: VISIBLE

[8px][👤][8px][👤][8px][👤][8px][+][8px]
     56px    56px    56px   60px

Min tap target: 56px (all tiles)
Horizontal scroll if > 3 participants
```

### ChatBar (Collapsed)

```
Height: 56px (including safe-area-bottom)

[8px][💬 Tap to chat..........][1][→][8px]
       flex (grows)          badge icon

Position: Bottom of screen
Background: Semi-transparent dark
Border: Top separator

Tap expands chat sheet above it
```

### ChatSheet

```
On xs/sm: 60% screen height
On md: 70% screen height
On lg: 75% screen height

┌──────────────────┐
│ handle (3px)     │  24px
├──────────────────┤
│ Chat         [X] │  40px
├──────────────────┤
│                  │
│ Messages...      │  Flex (scrollable)
│ ...              │
│                  │
├──────────────────┤
│ [Input...] [↑]   │  48px
└──────────────────┘
```

### Drawer

```
Width: min(280px, 100%)
Height: 100% (covers full screen)
Position: Slide in from right

┌─ 24px ─┐
│ Ctrl [X]│  40px
├─────────┤
│ ☐ Opt1  │  44px each
│ ☐ Opt2  │
│ ► Opt3  │
│ ─────── │  2px divider
│ THEME   │  14px label + 40px button row
│ [💜]    │
│         │
│ Tips... │  Info box
└─────────┘
```

---

## 3. COLOR PALETTE (CSS Variables)

### Background

```css
--troll-dark-bg: #06030e;       /* Primary: Very dark purple-black */
--troll-dark-card: #11081e;     /* Secondary: Slightly lighter */
```

### Accents

```css
--troll-gold: #ff5adf;          /* Neon pink - Primary accent */
--troll-cyan: #3ad7ff;          /* Neon cyan - Secondary accent */
--troll-white: #E2E2E2;         /* Soft white - Text */
```

### Control Colors (Purple Palette)

```
Light Purple:   rgba(167, 139, 250, 0.1)   ← Backgrounds
Medium Purple:  rgba(167, 139, 250, 0.3)   ← Borders (inactive)
Strong Purple:  rgba(167, 139, 250, 0.6)   ← Borders (active)
Lavender Text:  rgba(196, 181, 253, 0.95)  ← Labels

Active Glow:    0 0 12px rgba(167, 139, 250, 0.4)
Hover Shadow:   0 2px 8px rgba(0, 0, 0, 0.3)
```

### Status Colors

```
Live:           rgba(239, 68, 68, 0.9)     ← Red badge + pulsing dot
Unread Badge:   rgba(239, 68, 68, 0.8)     ← Red background
Success:        rgba(34, 197, 94, ...)     ← Green (optional)
Warning:        rgba(234, 179, 8, ...)     ← Yellow (optional)
```

---

## 4. TYPOGRAPHY

### Font Stack

```
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 
             "Segoe UI", "Noto Sans", ...
font-synthesis: none;
-webkit-font-smoothing: antialiased;
```

### Sizes & Weights

```
Display: 28px @ 700 (section titles - rarely used on mobile)
Headline: 20px @ 700 (major headers)
Title: 16px @ 700 (component titles - "Chat", "Controls")
Body: 14px @ 500 (standard text)
Small: 13px @ 500 (secondary text)
Tiny: 11px @ 600 (badges, micro UI)
```

### Usage

```
TopLiveBar timer:      12px @ 600
Live badge:            12px @ 700
Viewer count label:    12px @ 600
Button labels:         13px @ 600
Chat message username: 12px @ 600
Chat message text:     13px @ 400
Input placeholder:     13px @ 400
Drawer item label:     13px @ 500
```

---

## 5. SPACING SCALE

### Consistent Gap Scale

```
2px   - Micro gaps (rarely used)
4px   - Tiny gaps (inside tight groups)
8px   - Small gaps (standard between elements)
12px  - Medium gaps (between sections)
16px  - Large gaps (between major sections)
24px  - Extra large gaps (rarely on mobile)
```

### Applied Usage

```
Button padding:        8px 12px (compact on mobile)
Card padding:          12px
Container padding:     8-12px
Gap between tiles:     8px
Gap between sections:  12px
Top/bottom margin:     12px (rarely more)
```

---

## 6. BORDER RADIUS (Consistency)

```
Circular:    border-radius: 50%  (buttons, avatars)
Pill:        border-radius: 16px (rounded rectangles)
Card:        border-radius: 8px  (containers)
Sheet:       border-radius: 16px 16px 0 0 (bottom sheet - portrait)
Drawer:      border-radius: 0 (edge-to-edge)
Input:       border-radius: 8px
Tight:       border-radius: 6px  (small buttons)
```

---

## 7. ANIMATIONS

### Transitions (Smooth, Responsive)

```css
transition: all 0.2s ease;      /* Default: 200ms */
transition: all 0.3s ease;      /* Slower: sheets/drawers */
transition: opacity 0.15s ease; /* Fast: fades */
```

### Keyframe Animations

```css
/* Chat sheet slide-in */
@keyframes sheetSlideUp {
  from { opacity: 0; transform: translateY(100%); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 300ms ease-out */

/* Drawer slide-in from right */
@keyframes drawerSlideIn {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
/* Duration: 300ms ease-out */

/* Live badge pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
/* Duration: 1s infinite */
```

### User Interaction States

```
Button:
  Default  → Subtle border: rgba(purple, 0.3)
  Hover    → Brighter border: rgba(purple, 0.5)
  Active   → Glow + purple fill
  Pressed  → Slightly darker background

Input:
  Default  → Faint border
  Focused  → Brighter border + light purple background
  Filled   → Border stays bright
  Error    → Red border (if needed)

Toggle:
  Off      → Gray background, circle on left
  On       → Purple background, circle on right
```

---

## 8. RESPONSIVE BEHAVIOR BY BREAKPOINT

### xs (≤360px)

```
Layout: Ultra-compact
- TopLiveBar: 4px padding instead of 8px
- Buttons: 44px (min viable)
- Gaps: 4-8px (tight)
- ParticipantStrip: Hidden
- Participant tiles: Not shown
- Font sizes: Reduced by 1px
- Chart/Info: Stacked vertically
```

### sm (361–480px)

```
Layout: Compact but comfortable
- TopLiveBar: Normal spacing
- Buttons: 44px
- Gaps: 8px
- ParticipantStrip: Hidden
- Font sizes: Normal
- Drawer: Full width
```

### md (481–768px)

```
Layout: Expanded, comfortable
- TopLiveBar: Normal
- Buttons: 48px
- Gaps: 12px
- ParticipantStrip: Visible
- Participant tiles: 56x56px
- Drawer: 300px (min on tablets)
- Input grows: 2-3 rows
```

### lg (769–1024px)

```
Layout: Tablet-optimized
- TopLiveBar: Normal
- Buttons: 52px
- Gaps: 12px
- ParticipantStrip: Visible (larger tiles)
- Participant tiles: 64x64px
- Drawer: 320px
```

### desktop (≥1025px)

```
Layout: Desktop (original layout shown)
- Mobile container: display: none
- Desktop broadcast layout shown
- Full-size video grid
- Desktop sidebar chat
- No bottom sheet behavior
```

---

## 9. SAFE AREA VISUAL

### iPhone with Notch

```
┌──────────────────────────────────────┐
│ ◄ STATUS BAR ►                       │  ← safe-area-inset-top: ~44px
├──────────────────────────────────────┤
│ [🔴 LIVE] [👁 1.2K] [⋮]              │  ← Padded from notch
│                                      │
│ ████████ VIDEO STREAM ████████       │
│ ████████ WITH SAFE TOP    ████████   │
│ ████████ PADDING APPLIED  ████████   │
│ ████████████████████████████████     │
│ ████████████████████████████████     │
│                                      │
├──────────────────────────────────────┤
│ 💬 Tap to chat              [→]      │
├──────────┌─────────────────────┐     │
│         │ HOME INDICATOR      │      │  ← safe-area-inset-bottom: ~34px
└─────────└─────────────────────┘────┘
```

### Android with Notch (Similar)

```
┌──────────────────────────────────────┐
│ ❌ STATUS BAR ❌                      │  ← safe-area-inset-top: ~25px
├──────────────────────────────────────┤
│ [🔴 LIVE] [👁 1.2K] [⋮]              │
│                                      │
│ ████████ VIDEO STREAM ████████       │
│ ████████████████████████████████     │
│ ████████████████████████████████     │
│ ████████████████████████████████     │
│                                      │
├──────────────────────────────────────┤
│ 💬 Tap to chat              [→]      │
│                                      │  ← safe-area-inset-bottom: 0-24px
└──────────────────────────────────────┘   (system nav bar varies)
```

---

## 10. DO's and DON'Ts

### ✅ DO

```
✓ Use 44px minimum tap targets
✓ Keep top bar minimal (only 3-4 items max)
✓ Hide bottom nav during broadcast
✓ Use only one glow at a time
✓ Scroll content, don't wrap
✓ Apply safe area insets everywhere
✓ Test on real devices (not just emulator)
✓ Use system fonts (Inter for consistency)
✓ Keep video area dominant (≥60% of screen)
✓ Auto-scroll chat to latest message
✓ Preserve aspect ratio of participant tiles
```

### ❌ DON'T

```
✗ Don't make buttons < 44px on mobile
✗ Don't stack too many controls
✗ Don't use bright glows everywhere
✗ Don't force landscape orientation
✗ Don't permanently hide video controls
✗ Don't make chat wider than 100% on mobile
✗ Don't use heavy shadows everywhere
✗ Don't nest drawers/sheets
✗ Don't require scrolling to see video
✗ Don't truncate usernames without tooltips
✗ Don't use thin borders (< 1px on mobile)
```

---

## 11. ACCESSIBILITY

### Touch Targets

```
Minimum:     44x44px (accessible level)
Ideal:       48x48px (comfortable on phone)
Large:       56x56px (easy to tap)
Gap between: 8px (no accidental touches)
```

### Color Contrast

```
Buttons:     WCAG AA (4.5:1 text on background)
Badges:      WCAG AA (4.5:1)
Inactive:    WCAG A (3:1 minimum)
Active:      WCAG AAA (7:1 for emphasis)
```

### Keyboard Navigation

```
Tab order:   Top bar → Actions → Chat bar
Enter:       Send message in chat input
Escape:      Close sheet/drawer
Space:       Toggle button
```

### Screen Reader

```
Button labels: aria-label="Mute microphone"
Live badge:    role="status" (announces changes)
Unread count:  aria-label="2 unread messages"
```

---

## 12. EXAMPLE COLOR COMBINATIONS

### Purple Theme (Default)

```
Background: #06030e (very dark)
Accent:     rgba(167, 139, 250, 0.3) (purple border)
Active:     rgba(167, 139, 250, 0.6) + glow (bright purple)
Text:       #E2E2E2 (soft white)
```

### Neon Theme

```
Background: #06030e (very dark)
Accent:     rgba(58, 215, 255, 0.3) (cyan border)
Active:     rgba(58, 215, 255, 0.8) + glow (bright cyan)
Text:       #E2E2E2 (soft white)
Live badge: #ff5adf (neon pink)
```

### RGB Theme

```
Background: #06030e (very dark)
Accent:     Animated rainbow (expensive, use sparingly)
Active:     Rainbow glow
Text:       #E2E2E2 (soft white)
```

---

**Design Reference v1.0 | January 2026**
