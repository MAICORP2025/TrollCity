# AUDIT_BACKEND.md — Troll City Backend Resource Audit

> Generated: 2026-06-09
> Scope: All Supabase tables, views, functions, RPCs, edge functions, triggers, policies, storage

---

## 📊 Backend Summary

| Metric | Count |
|---|---|
| Edge Functions | 126 |
| SQL Migration Files | 898 |
| Active Migrations (applied) | ~100+ |
| Estimated Database Tables | ~80+ |
| Estimated RPC Functions | ~100+ |
| Estimated Storage Buckets | ~15 |
| Row Level Security Policies | ~50+ |
| Database Views | ~15 |
| Database Triggers | ~25 |

---

## 🗄️ Edge Functions (Supabase Functions)

### Authentication & User Management
| # | Function | Purpose | Status |
|---|---|---|---|
| 1 | `auth` | Auth management | ✅ Active |
| 2 | `ai-verify-user` | AI-powered user verification | ✅ Active |
| 3 | `gemini-verify-user` | Gemini-based verification | ✅ Active |
| 4 | `verify-user-complete` | Finalize verification | ✅ Active |
| 5 | `ai-detect-ghost-inactivity` | Detect inactive ghost users | ✅ Active |
| 6 | `delete-account` | User account deletion | ✅ Active |
| 7 | `password-manager` | Password management | ✅ Active |

### Admin & Moderation
| # | Function | Purpose | Status |
|---|---|---|---|
| 8 | `admin` | Admin operations | ✅ Active |
| 9 | `admin-actions` | Admin action logging | ✅ Active |
| 10 | `admin-reset` | System reset tools | ⚠️ Partial |
| 11 | `admin-scheduler` | Admin task scheduling | ✅ Active |
| 12 | `admin-stats` | Admin statistics | ✅ Active |
| 13 | `admin-stock-manager` | Stock market management | ✅ Active |
| 14 | `customer-service-admin` | Customer service tools | ✅ Active |
| 15 | `moderation` | Content moderation | ✅ Active |
| 16 | `apply-punishment` | Apply punishments | ✅ Active |
| 17 | `shadow-ban-user` | Shadow ban system | ✅ Active |
| 18 | `log-moderation-event` | Log moderation events | ✅ Active |
| 19 | `send-announcement` | Send announcements | ✅ Active |
| 20 | `send-bulk-notifications` | Bulk notifications | ✅ Active |
| 21 | `send-like` | Send likes | ✅ Active |
| 22 | `send-message` | Send messages | ✅ Active |
| 23 | `dismiss-notification` | Dismiss notifications | ✅ Active |
| 24 | `update-notification-preferences` | Notification prefs | ✅ Active |
| 25 | `push-notifications` | Push notification system | ✅ Active |
| 26 | `process-offline-notifications` | Offline notification queue | ✅ Active |
| 27 | `debug-push` | Push notification debugging | ❓ Dev only |

### Broadcasting & Streaming
| # | Function | Purpose | Status |
|---|---|---|---|
| 28 | `live` | Live streaming management | ✅ Active |
| 29 | `go-live-mark-mark` | Go live / mark live | ✅ Active |
| 30 | `go-live-refund-hd-boost` | HD boost refund | ✅ Active |
| 31 | `agora-media-gateway` | Agora media gateway | ✅ Active |
| 32 | `agora-stream` | Agora streaming | ✅ Active |
| 33 | `agora-token` | Agora token generation | ✅ Active |
| 34 | `agora-walkie-token` | Walkie-talkie tokens | ✅ Active |
| 35 | `livekit-token` | LiveKit token generation | ✅ Active |
| 36 | `livekit-webhooks` | LiveKit webhooks | ✅ Active |
| 37 | `livekit-gaming` | LiveKit gaming streams | ✅ Active |
| 38 | `broadcast-seats` | Broadcast seat management | ✅ Active |
| 39 | `streams-maintenance` | Stream maintenance | ✅ Active |
| 40 | `stream-health-monitor` | Stream health checks | ✅ Active |
| 41 | `track-guest` | Guest tracking | ✅ Active |
| 42 | `calc_post_earnings` | Post earnings calculation | ✅ Active |
| 43 | `capture-content` | Content capture | ✅ Active |
| 44 | `upload-to-cloudflare-stream` | Cloudflare stream upload | ✅ Active |
| 45 | `generate-obs-credentials` | OBS credentials | ✅ Active |
| 46 | `generate-ad` | Ad generation | ✅ Active |
| 47 | `ghost-mode` | Ghost mode | ✅ Active |
| 48 | `toggle-ghost-mode` | Ghost mode toggle | ✅ Active |
| 49 | `complete-ghost-mission` | Ghost mission completion | ✅ Active |

### Battles & Gaming
| # | Function | Purpose | Status |
|---|---|---|---|
| 50 | `universal-battle` | Universal battle system | ✅ Active |
| 51 | `troll-battle` | Troll battles | ✅ Active |
| 52 | `troll-us-game` | Troll Us game | ✅ Active |
| 53 | `select-winner` | Battle winner selection | ✅ Active |
| 54 | `stock-gamification` | Stock gamification | ✅ Active |
| 55 | `stock-price-engine` | Stock price engine | ✅ Active |

### Economy & Payments
| # | Function | Purpose | Status |
|---|---|---|---|
| 56 | `payments` | Payment processing | ✅ Active |
| 57 | `payments-status` | Payment status | ✅ Active |
| 58 | `payments-status` | Payment status check | ✅ Active |
| 59 | `paypal-create-order` | PayPal order creation | ✅ Active |
| 60 | `paypal-complete-order` | PayPal order completion | ✅ Active |
| 61 | `paypal-payout` | PayPal payouts | ✅ Active |
| 62 | `paypal-verify-transaction` | PayPal verification | ✅ Active |
| 63 | `paypal-webhook` | PayPal webhook | ✅ Active |
| 64 | `paypal-health` | PayPal health check | ✅ Active |
| 65 | `create-paypal-order` | PayPal order (alt) | ⚠️ Duplicate |
| 66 | `fulfill-paypal-purchase` | PayPal fulfillment | ✅ Active |
| 67 | `verify-paypal-payment` | PayPal payment verify | ✅ Active |
| 68 | `create-square-checkout` | Square checkout | ✅ Active |
| 69 | `create-square-customer` | Square customer creation | ✅ Active |
| 70 | `square-save-card` | Square card saving | ✅ Active |
| 71 | `square-webhook` | Square webhook | ✅ Active |
| 72 | `verify-square-payment` | Square payment verify | ✅ Active |
| 73 | `charge-stored-card` | Charge saved card | ✅ Active |
| 74 | `save-card` | Save card | ✅ Active |
| 75 | `add-card` | Add payment card | ✅ Active |
| 76 | `process-payout-batch` | Payout batch processing | ✅ Active |
| 77 | `platform-fees` | Platform fee calculation | ✅ Active |
| 78 | `process-referral-bonuses` | Referral bonus processing | ✅ Active |
| 79 | `manual-coin-order` | Manual coin orders | ✅ Active |
| 80 | `bank-apply` | Bank loan application | ✅ Active |
| 81 | `bank-credit` | Bank credit system | ✅ Active |
| 82 | `credit-daily-maintenance` | Credit daily maintenance | ✅ Active |
| 83 | `credit-loan-handler` | Credit loan handler | ✅ Active |
| 84 | `credit-record-event` | Credit event recording | ✅ Active |
| 85 | `credit-small-purchase-milestone` | Credit milestones | ✅ Active |
| 86 | `loan-payment` | Loan payment | ✅ Active |
| 87 | `platform-fees` | Platform fee system | ✅ Active |

### Institutions & Organizations
| # | Function | Purpose | Status |
|---|---|---|---|
| 88 | `agency-weekly-evaluation` | Agency weekly eval | ✅ Active |
| 89 | `officer-actions` | Officer actions | ✅ Active |
| 90 | `officer-auto-clockout` | Auto clock-out | ✅ Active |
| 91 | `officer-get-assignment` | Get assignment | ✅ Active |
| 92 | `officer-join-stream` | Join stream | ✅ Active |
| 93 | `officer-leave-stream` | Leave stream | ✅ Active |
| 94 | `officer-report-abuse` | Report abuse | ✅ Active |
| 95 | `officer-touch-activity` | Activity tracking | ✅ Active |
| 96 | `trollcourt-ai` | Court AI | ✅ Active |
| 97 | `start-officer-vote-cycle` | Officer voting | ✅ Active |
| 98 | `close-officer-vote-cycle` | Close voting | ✅ Active |
| 99 | `vote-for-officer` | Officer voting | ✅ Active |
| 100 | `expire-officer-roles` | Role expiration | ✅ Active |
| 101 | `auto-clock-out` | Auto clock-out | ✅ Active |
| 102 | `cron-tasks` | Cron job tasks | ✅ Active |
| 103 | `customer-service-admin` | Customer service | ✅ Active |

### Mai Talent System
| # | Function | Purpose | Status |
|---|---|---|---|
| 104 | `mai-talent-timer-watcher` | Mai talent timer | ✅ Active |
| 105 | `mai-talent-v2-orchestrator` | Mai talent orchestrator | ✅ Active |

### Stock Market
| # | Function | Purpose | Status |
|---|---|---|---|
| 106 | `stock-gamification` | Stock gamification | ✅ Active |
| 107 | `stock-price-engine` | Stock price engine | ✅ Active |
| 108 | `end-home-feature-cycle` | Home feature cycle | ✅ Active |

### Utility
| # | Function | Purpose | Status |
|---|---|---|---|
| 109 | `ping` | Health check | ✅ Active |
| 110 | `magicbell-jwt` | MagicBell JWT | ✅ Active |
| 111 | `publish-social` | Social publishing | ✅ Active |
| 112 | `social-oauth-init` | Social OAuth init | ✅ Active |
| 113 | `social-oauth-callback` | Social OAuth callback | ✅ Active |
| 114 | `report-bug` | Bug reporting | ✅ Active |
| 115 | `store-user-geolocation` | Geolocation storage | ✅ Active |
| 116 | `get-training-scenario` | Training scenarios | ✅ Active |
| 117 | `submit-training-response` | Training responses | ✅ Active |
| 118 | `delete-user-account` | Account deletion | ✅ Active |
| 119 | `process-audio-queue` | Audio queue | ✅ Active |
| 120 | `process-audio-safety` | Audio safety | ✅ Active |
| 121 | `generate-pdf` | PDF generation | ✅ Active |
| 122 | `verify-user-complete` | Verification complete | ✅ Active |
| 123 | `troll-events` | Troll event system | ✅ Active |
| 124 | `global-ticker-notify` | Ticker notifications | ✅ Active |

---

## 🗃️ Database Tables (Estimated from Migrations)

Based on migration file analysis, the following ~80+ tables exist:

### Core User Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `user_profiles` | User profiles | Nearly all features |
| `user_levels` | XP/level system | Profile, rewards |
| `user_credit` | Credit scores | Banking |
| `user_cars` | User vehicles | Garage, dealership |
| `user_tax_info` | Tax information | Payouts |
| `user_agreement_log` | Agreement tracking | Legal |

### Content Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `broadcasts` | Broadcast records | Watch, discover |
| `broadcast_analytics` | Stream analytics | Admin |
| `broadcast_seats` | Seat management | Streaming |
| `broadcast_seat_bans` | Seat bans | Moderation |
| `broadcast_chat_messages` | Chat messages | Chat |
| `stream_sessions` | Stream sessions | Analytics |
| `stream_seat_sessions` | Seat sessions | Streaming |
| `posts` | User posts | Feed |
| `comments` | Post comments | Feed |
| `post_reactions` | Post reactions | Feed |
| `post_media` | Post media | Feed |
| `troll_city_wall` | City wall posts | Wall |
| `wall_post_reactions` | Wall reactions | Wall |

### Economy Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `wallet_transactions` | Wallet transactions | Wallet |
| `coin_purchases` | Coin purchases | Store |
| `coin_transactions` | Coin ledger | Wallet |
| `manual_orders` | Manual orders | Admin |
| `payout_requests` | Payout requests | Payouts |
| `payout_batches` | Payout batches | Admin |
| `paypal_transactions` | PayPal transactions | Payments |
| `stripe_coin_purchases` | Stripe purchases | Payments |
| `bank_accounts` | Bank accounts | Banking |
| `bank_loans` | Bank loans | Banking |
| `user_bank_loans` | User loans | Banking |
| `troll_city_treasury` | City treasury | Treasury |
| `troll_city_agency_fees` | Agency fees | Economy |
| `store_items` | Store items | Shop |
| `store_purchases` | Store purchases | Shop |
| `paid_agency_applications` | Agency applications | Agencies |

### Institution Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `jail` | Jail system | Moderation |
| `jail_bail` | Jail bail | Jail |
| `court_dockets` | Court dockets | Court |
| `court_cases` | Court cases | Court |
| `court_rulings` | Court rulings | Court |
| `appeals` | Appeals | Jail |
| `insurance_plans` | Insurance plans | Insurance |
| `property` | Properties | Real estate |
| `property_insurance` | Property insurance | Insurance |
| `rental_marketplace` | Rentals | Real estate |
| `vehicle_asset_system` | Vehicles | Garage |
| `broadcast_themes` | Stream themes | Broadcasting |
| `broadcast_categories` | Stream categories | Broadcasting |

### Organization Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `agencies` | Agencies | Agency system |
| `agency_members` | Agency members | Agency system |
| `agency_invites` | Agency invites | Agency system |
| ` agencies_applications` | Agency applications | Agency system |
| `agency_earnings` | Agency earnings | Agency system |
| `organizations` | Organizations | Organization system |
| `organization_members` | Organization members | Organization system |
| `organization_files` | Organization files | Organization system |

### Government Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `election_cycles` | Election cycles | Government |
| `candidates` | Candidates | Government |
| `votes` | Votes | Government |
| `laws` | City laws | Government |
| `protests` | Protests | Government |
| `political_parties` | Parties | Government |
| `zip_jurisdictions` | Zip jurisdictions | Government |
| `government_staff` | Gov staff | Government |

### Officer Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `officers` | Officer records | Officer system |
| `officer_shifts` | Shift schedules | Officer system |
| `officer_reports` | Officer reports | Officer system |
| `officer_assignments` | Assignments | Officer system |
| `officer_time_off` | Time off requests | Officer system |
| `officer_panic_alerts` | Panic alerts | Officer system |
| `officer_employment_types` | Employment types | Officer system |
| `staff_notifications` | Staff notifications | Officer system |

### Academy Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `academy_courses` | Academy courses | Academy |
| `academy_enrollments` | Enrollments | Academy |
| `academy_assignments` | Assignments | Academy |
| `academy_submissions` | Submissions | Academy |
| `academy_quizzes` | Quizzes | Academy |
| `academy_quiz_attempts` | Quiz attempts | Academy |
| `academy_attendance` | Attendance | Academy |
| `academy_certificates` | Certificates | Academy |
| `academy_grades` | Grades | Academy |
| `academy_transcripts` | Transcripts | Academy |
| `academy_pathways` | Learning pathways | Academy |
| `academy_loans` | Academy loans | Academy |
| `academy_teacher_courses` | Teacher courses | Academy |

### Family & Social Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `families` | Families | Family system |
| `family_members` | Family members | Family system |
| `family_invites` | Family invites | Family system |
| `family_wars` | Family wars | Family system |
| `family_chat` | Family chat | Family system |
| `trollmatch_family_invites` | TM family invites | Family system |
| `blocked_users` | Blocked users | Social |

### Communication Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `conversations` | Conversations | Messaging |
| `conversation_members` | Conversation members | Messaging |
| `messages` | Messages | Messaging |
| `notifications` | Notifications | Notifications |
| `announcements` | Announcements | Admin |
| `tromail` | Tromail messages | Mail |
| `tromail_contracts` | Tromail contracts | Mail |
| `utromail` | U-TroMail messages | Mail |
| `tcps_messages` | TCPS messages | TCPS |

### TCNN (News) Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `tcnn_articles` | News articles | TCNN |
| `tcnn_article_revisions` | Article revisions | TCNN |
| `tcnn_live_streams` | Live news streams | TCNN |
| `tcnn_ticker_queue` | Ticker queue | TCNN |
| `tcnn_breaking_alerts` | Breaking alerts | TCNN |

### Event System Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `events` | Events | Events |
| `event_participants` | Event participants | Events |
| `event_registrations` | Event registrations | Events |
| `universe_events` | Universe events | Events |

### Gaming Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `battles` | Battle records | Gaming |
| `battle_participants` | Battle participants | Gaming |
| `tournament_participants` | Tournament participants | Gaming |
| `trollers_tournament` | Trollers tournament | Gaming |
| `stock_trades` | Stock trades | Gaming |
| `stock_portfolios` | Stock portfolios | Gaming |

### Church Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `church_sermons` | Sermons | Church |
| `church_live_sessions` | Church sessions | Church |
| `church_prayers` | Prayer requests | Church |
| `pastor_applications` | Pastor applications | Church |

### Share-A-Thon Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `shareathon_entries` | Share-A-Thon entries | Share-A-Thon |
| `shareathon_verifications` | Verification | Share-A-Thon |

### Mail System Tables
| Table | Purpose | Referenced By |
|---|---|---|
| `tromail_messages` | Tromail messages | Mail |
| `tromail_contracts` | Tromail contracts | Mail |
| `utromail_messages` | U-TroMail messages | Mail |

---

## 📦 Storage Buckets

| Bucket | Purpose | Status |
|---|---|---|
| `avatars` | User avatar uploads | ✅ Active |
| `banners` | Banner images | ✅ Active |
| `post-media` | Post media uploads | ✅ Active |
| `broadcast-media` | Broadcast media | ✅ Active |
| `gift-media` | Gift animations/videos | ✅ Active |
| `verification-files` | ID verification uploads | ✅ Active |
| `appeal-media` | Appeal evidence uploads | ✅ Active |
| `podcast-covers` | Podcast cover art | ✅ Active |
- `contracts` | Contract documents | ✅ Active |
| `notary-docs` | Notarized documents | ✅ Active |
| `startup-assets` | Startup expense assets | ✅ Active |
| `course-media` | Academy course media | ✅ Active |
| `certificate-files` | Certificate PDFs | ✅ Active |
| `chat-attachments` | Chat file attachments | ✅ Active |
| `bug-attachments` | Bug report attachments | ✅ Active |

---

## ⚠️ Issues & Concerns

### Duplicate/Redundant Edge Functions
- `create-paypal-order` appears to be a duplicate of `paypal-create-order`
- Multiple credit-related functions may have overlapping functionality
- Several migration files in `migrations_backup/` and `migrations_conflicted_backup/` are **NOT applied**

### Dead Code Risk
- ~400+ migration files in `migrations_backup/`, `migrations_conflicted_backup/`, and `pending_ignored/` directories — these are NOT applied and represent abandoned/failed migrations
- Some edge functions may be orphaned (created for features later removed)

### Missing Functions
- Real-time channel diagnostics (`logActiveChannels`) exists but is not exposed via RPC
- No dedicated RPC for bulk user role updates

---

## 📊 Backend Completion %

| Category | Completion |
|---|---|
| User Management | 95% |
| Authentication | 100% |
| Broadcasting/Streaming | 90% |
| Economy/Payments | 90% |
| Moderation/Jail | 95% |
| Family System | 90% |
| Agency System | 90% |
| Government | 85% |
| Officer System | 90% |
| Academy System | 85% |
| Auction System | 90% |
| TCNN News | 85% |
| Church System | 90% |
| Gaming/Battle | 85% |
| Mail Systems | 90% |
| Share-A-Thon | 90% |
| **OVERALL BACKEND** | **~90%** |
