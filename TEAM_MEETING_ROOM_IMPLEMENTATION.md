# Team Meeting Room - Implementation Guide

## Overview

The Team Meeting Room is a dedicated video conferencing space for team meetings with a 3x3 grid layout supporting up to 9 visible participants. It features CEO/Admin priority positioning, Hold Box functionality to lock participant positions, and real-time speaking indicators.

## Features

### 1. 3x3 Grid Layout
- **Desktop**: Full 3x3 grid (9 participant boxes)
- **Tablet**: Responsive 2x3 or 2x2 layout
- **Mobile**: Stack view with primary speaker focus and participant list overlay

### 2. CEO/Admin Priority System
The system automatically positions participants with the following priority:
1. **CEO** - Always gets center middle box (row 2, col 2) if present
2. **Admin** - Gets center if CEO not present
3. **Active Speaker** - Gets center if no CEO/Admin present (and not locked by Hold Box)
4. **Local User** - Prioritized in visible grid
5. **Others** - Filled by join order

### 3. Hold Box Button
- **Purpose**: Lock a participant's position in the grid
- **Behavior**:
  - When enabled, the participant stays in their current box regardless of speaking status
  - Speaking status doesn't move a held participant to center
  - Local UI only - doesn't affect LiveKit publishing/subscribing
  - Toggle button visible on each tile (Lock/Unlock icon)

### 4. Speaking Indicator
- **Visual Indicators**:
  - Animated green badge with "Speaking" label
  - Pulsing animation while speaking
  - Glowing border effect on active speaker
- **Detection**: Uses LiveKit audio level monitoring (threshold: 5)
- **Update Rate**: 100ms detection interval

### 5. Participant Information Display
Each tile shows:
- **Video Stream** - Live video from participant
- **Avatar/Placeholder** - Purple gradient with initials if camera is off
- **Status Bar** (Top Left):
  - Username
  - Role (capitalized)
  - CEO/Admin badge (if applicable)
- **Status Icons** (Bottom Left):
  - Microphone status (green on, red off)
  - Camera status (green on, red off)
- **Speaking Indicator** (Top Right):
  - Green animated badge when participant is speaking
- **Hold Box Button** (Bottom Right):
  - Lock icon when held
  - Unlock icon when not held

### 6. Overflow Handling
- **Max Visible**: 9 participants in main grid
- **Overflow Display**: Shows count of waiting participants
- **Waiting List**: Participants beyond 9 are shown in info banner
- **Future Enhancement**: Implement scrollable waiting list or pagination

## File Structure

```
src/
├── components/
│   └── TeamMeetingRoom/
│       ├── TeamMeetingGrid.tsx         # Main 3x3 grid component
│       ├── ResponsiveTeamGrid.tsx      # Responsive layout wrapper
│       └── index.ts                    # Component exports
├── pages/
│   └── TeamMeetingRoom.tsx             # Main page component
└── hooks/
    └── useLiveKitRoom.ts               # Updated to support 'team_meeting' room type
```

## Component APIs

### TeamMeetingGrid Props

```typescript
interface TeamMeetingGridProps {
  localUserId: string;                   // Current user's ID
  remoteUsers: RemoteParticipant[];     // LiveKit remote participants
  localVideoTrack?: LocalVideoTrack;    // Local video stream
  localAudioTrack?: LocalAudioTrack;    // Local audio stream
  localUsername: string;                 // Current user's username
  localRole: string;                     // Current user's role
  toggleCamera: () => void;              // Function to toggle camera
  toggleMicrophone: () => void;          // Function to toggle mic
  isMicMuted: boolean;                   // Current mic state
  isCameraMuted: boolean;                // Current camera state
  meetingId: string;                     // Staff meeting ID
}
```

### TeamMeetingRoom Props (Page)

- Automatically fetches meeting details and user profile
- Manages LiveKit room connection
- Handles participant tracking and overflow

### ResponsiveTeamGrid Props

```typescript
interface ResponsiveTeamGridProps {
  children: React.ReactNode;
  isMobileView?: boolean;
  maxVisibleOnMobile?: number;
}
```

### MobileTeamMeetingView Props

```typescript
interface MobileTeamMeetingViewProps {
  primaryParticipant: TeamParticipant;
  secondaryParticipants: TeamParticipant[];
  onTogglePrimary?: () => void;
}
```

## Database Integration

The feature integrates with two main tables:

### staff_meetings
```sql
CREATE TABLE staff_meetings (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  room_name VARCHAR(255) UNIQUE,        -- LiveKit room name
  status VARCHAR(50),                    -- scheduled | live | ended | cancelled
  max_participants INTEGER DEFAULT 9,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### staff_meeting_participants
```sql
CREATE TABLE staff_meeting_participants (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES staff_meetings(id),
  user_id UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  is_active BOOLEAN,
  UNIQUE(meeting_id, user_id)
);
```

## User Profile Fields Used

The component fetches the following fields from `user_profiles`:
- `id` - User identifier
- `username` - Display name in tiles
- `role` - User's role (admin, user, etc.)
- `is_admin` - Admin privilege flag
- `is_ceo` - CEO flag (highest priority)

## Route

Add this route to your routing configuration to access the Team Meeting Room:

```typescript
<Route path="/meeting/:meetingId" element={<TeamMeetingRoom />} />
```

**URL Example**: `/meeting/a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6`

## Usage Example

```typescript
import { TeamMeetingRoom } from '@/pages/TeamMeetingRoom';

// In your routing:
<Route path="/meeting/:meetingId" element={<TeamMeetingRoom />} />

// Navigate to meeting:
navigate(`/meeting/${meetingId}`);
```

## Styling & Theming

The component uses:
- **Tailwind CSS** for responsive design
- **Framer Motion** for animations:
  - Smooth tile layout transitions
  - Pulsing speaking indicators
  - Fade-in animations for overlays
- **Lucide React** for icons:
  - Microphone status (Mic, MicOff)
  - Camera status (Video, VideoOff)
  - Hold box control (Lock, Unlock)
  - Participant count (Users)

### Color Scheme
- **Background**: `bg-gray-950` (dark)
- **Cards**: `bg-gray-900` border `border-gray-700`
- **Focus**: `border-blue-500` with `shadow-blue-500/50`
- **Held**: `border-yellow-400` dashed border
- **Speaking**: `border-green-500`
- **Status Icons**: Green `text-green-400` (on), Red `text-red-400` (off)

## Key Logic

### Participant Ordering Algorithm

1. **Collect held participants** - Those with Hold Box enabled
2. **Collect non-held participants** - Everyone else
3. **Sort non-held by priority**:
   - CEO > Admin > Speaking > Local User > Others
4. **Combine**: `[...held, ...non-held]`
5. **Slice to MAX_VISIBLE** (9 participants)

### Speaking Detection

```typescript
useEffect(() => {
  const audioLevelThreshold = 5; // Adjust for sensitivity
  const interval = setInterval(() => {
    remoteUsers.forEach(user => {
      if (user.audioLevel > audioLevelThreshold) {
        // User is speaking
      }
    });
  }, 100);
}, [remoteUsers]);
```

### Center Focus Position

Priority for center middle box:
1. If CEO present → show CEO
2. Else if Admin present → show Admin
3. Else if speaker present → show speaker
4. Else → show first visible participant

## Performance Considerations

- **Track Attachment**: Tracks are re-attached only when the SID changes
- **Profile Caching**: User profiles are fetched once and cached in state
- **Audio Level Updates**: 100ms polling interval for speaking detection
- **Animation Optimization**: Framer Motion `layoutId` for smooth grid transitions

## Responsive Behavior

### Desktop (768px+)
- Full 3x3 grid
- All 9 boxes visible simultaneously
- Hover tooltips on buttons

### Tablet (600px-768px)
- 2x3 grid (6 visible boxes)
- Scroll within grid for additional participants
- Full touch-friendly controls

### Mobile (<600px)
- Primary speaker full screen
- Participant list in collapsible overlay
- Tap to toggle overlay
- Stack-based navigation

## Mobile View Implementation

The `MobileTeamMeetingView` component:
- Shows largest speaker (CEO/Admin/Current Speaker) full screen
- Displays other participants in scrollable list overlay
- Minimizable overlay with participant count
- Touch-optimized controls

## Security & Access Control

- Meetings require user to be in `staff_meeting_participants`
- Access control via `can_access_staff_meeting()` RLS function
- Only admins/lead officers can start meetings
- Participant tracking for audit trails
- Meeting status: scheduled → live → ended

## Accessibility Features

- Keyboard controls for local camera/mic toggle
- Screen reader friendly participant labels
- High contrast status indicators
- Clear role/status badges
- Speaking indicator animations follow WCAG guidelines

## Troubleshooting

### Participants Not Appearing
1. Check LiveKit connection (`isConnected` state)
2. Verify user profiles are being fetched
3. Check browser console for LiveKit errors

### Speaking Indicator Not Working
1. Adjust `audioLevelThreshold` if too sensitive
2. Verify remote users have audio published
3. Check browser audio permissions

### Hold Box Not Persisting
- Hold Box is local UI state - refreshing the page resets it
- Current by design (not saved to database)

### Overflow Not Showing
- Check if `allParticipants.length > MAX_VISIBLE` (9)
- Verify overflow banner styling in ResponsiveTeamGrid

## Future Enhancements

1. **Persistent Hold Box State** - Save to database or localStorage
2. **Grid Size Options** - Configurable 3x3, 2x3, or 2x2 layouts
3. **Participant Search** - Find participants in overflow list
4. **Screen Sharing** - Dedicated screen share view
5. **Recording** - Mux integration for meeting recordings
6. **Chat Integration** - Side panel for meeting chat
7. **Hand Raise Feature** - Users can signal without speaking
8. **Virtual Backgrounds** - Blur or replace backgrounds
9. **Meeting History** - Replay and recordings
10. **Analytics Dashboard** - Attendance, engagement metrics

## Integration Checklist

- [x] Create TeamMeetingGrid component
- [x] Create TeamMeetingRoom page
- [x] Create ResponsiveTeamGrid wrapper
- [x] Update useLiveKitRoom hook documentation
- [x] Add route to App.tsx
- [x] Database tables already exist (staff_meetings, staff_meeting_participants)
- [ ] Test with actual LiveKit backend
- [ ] Test mobile responsiveness
- [ ] Add meeting creation UI
- [ ] Add meeting scheduling UI
- [ ] Test participant overflow scenarios
- [ ] Test speaking detection with actual audio

## Support & Questions

For issues or questions about the Team Meeting Room implementation, refer to:
1. Component inline comments
2. TypeScript interfaces for API contracts
3. LiveKit documentation for streaming specifics
4. Tailwind CSS for styling customization
