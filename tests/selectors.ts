// Centralized selectors for ViewerPage tests
// Use these to avoid brittle tests that break on class changes

export const selectors = {
  // Auth
  auth: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    signInButton: 'button:has-text("Sign In"), button:has-text("Sign in")',
    signUpButton: 'button:has-text("Sign Up"), button:has-text("Sign up")',
  },

  // Chat
  chat: {
    input: 'textarea[placeholder*="Say something"], textarea[placeholder*="Message"], textarea[placeholder*="chat"]',
    sendButton: 'button[type="submit"]',
    messageContainer: '[data-testid="chat-message"], .chat-message, [class*="chatMessage"]',
    paywallModal: 'text=Pay.*coins.*to chat',
    paidChatError: 'text=/Insufficient|not enough|need.*coins/i',
    rateLimitError: 'text=/too fast|rate limit|autoclicker/i',
  },

  // Troll Toe
  trollToe: {
    uiContainer: 'text=Troll Toe',
    joinBroadcasterButton: 'button:has-text("Broadcaster")',
    joinChallengerButton: 'button:has-text("Challenger")',
    fogButton: 'button:has-text("FOG")',
    statusText: 'text=/Queued|In Game|Spectating|Fogged|Winner|Defeated/i',
    phaseLabel: 'text=/waiting|filling|live|paused|ended/i',
  },

  // Battle
  battle: {
    scoreDisplay: 'text=/Team A|Team B/i',
    timerDisplay: 'text=/\\d+:\\d{2}/',
    vsText: 'text=VS',
  },

  // Header / Stats
  stats: {
    viewerCount: 'text=Viewers',
    likeCount: 'text=Likes',
    coinsDisplay: 'text=Coins',
  },

  // Broadcast-specific
  broadcast: {
    videoPlayer: 'video, [class*="VideoPlayer"]',
    addBoxButton: `button[title="Add broadcast box"], button:has-text("Add")`,
    removeBoxButton: `button[title="Deduct broadcast box"], button:has-text("Deduct")`,
    boxCountIndicator: '[data-testid="box-count"], .box-count-display',
    moreMenuButton: 'button:has-text("More"), button[aria-label="More"]',
    paidChatSettings: 'text=Paid Chat Settings',
    saveSettingsButton: 'button:has-text("Save Settings")',
  },

  // Error / Status
  status: {
    jailBanner: 'text=/jail|in jail|jailed/i',
    toast: '[role="alert"], .toast, [class*="Toast"]',
  },
};

// Test users - copy from chat.spec.ts
export const TEST_USERS = {
  richViewer: { email: 'viewer.rich@test.troll', password: 'password123', role: 'viewer', coins: 500 },
  poorViewer: { email: 'viewer.poor@test.troll', password: 'password123', role: 'viewer', coins: 10 },
  trollOfficer: { email: 'officer@test.troll', password: 'password123', role: 'troll_officer' },
  leadOfficer: { email: 'lead@test.troll', password: 'password123', role: 'lead_troll_officer' },
  jailedUser: { email: 'jailed@test.troll', password: 'password123', role: 'viewer', jailed: true },
  broadcaster: { email: 'broadcaster@test.troll', password: 'password123', role: 'broadcaster' },
} as const;

export function getTestUser(role: keyof typeof TEST_USERS) {
  return TEST_USERS[role];
}

