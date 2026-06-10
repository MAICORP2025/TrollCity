# AUDIT_PLATFORM_INVENTORY.md — Troll City Full Route & Page Inventory

> Generated: 2026-06-09
> Codebase version: 1.0.0
> Audit scope: Complete application — all routes, pages, modals, drawers, tabs, components

---

## 📊 High-Level Counts

| Metric | Count |
|---|---|
| Total Routes (unique path patterns) | ~230 |
| Total Pages (lazy-loaded components) | ~165 |
| Total Components (src/components) | ~569 |
| Total Page-level TSX files (src/pages) | ~507 |
| Total Edge Functions | ~126 |
| Total Migration Files | ~898 |
| Total Database Tables (from migrations) | ~80+ |
| Total Service Files | ~12 |
| Total Store Files (Zustand) | ~10 |
| Total Type Definition Files | ~36 |
| Total Context Providers | ~13 |
| Total Custom Hooks | ~146 |

---

## 🗂️ Route Table — Every Route in App.tsx

### PUBLIC ROUTES (No Authentication Required)

| # | Route | Page Component | File Location | Purpose | Status |
|---|---|---|---|---|---|
| 1 | `/` | AuthenticatedHome | src/pages/Home.tsx (lazy) | Main home page / landing | ✅ Working |
| 2 | `/auth` | Auth | src/pages/Auth.js | Login/Registration | ✅ Working |
| 3 | `/auth/callback` | AuthCallback | src/pages/AuthCallback.js | OAuth callback handler | ✅ Working |
| 4 | `/exit` | ExitPage | src/pages/ExitPage.js | Internal exit flow (internal nav only) | ⚠️ Partial |
| 5 | `/access-denied` | AccessDenied | src/pages/AccessDenied.tsx | Access denied page | ✅ Working |
| 6 | `/reset-password` | PasswordReset | src/pages/PasswordReset.tsx | Password reset flow | ✅ Working |
| 7 | `/tax-onboarding` | TaxOnboarding | src/pages/TaxOnboarding.tsx | Tax form onboarding | ⚠️ Partial |
| 8 | `/verification` | VerificationPage | src/pages/VerificationPage.tsx | Identity verification | ✅ Working |
| 9 | `/verification/complete` | VerificationComplete | src/pages/VerificationComplete.tsx | Verification completion | ✅ Working |
| 10 | `/founding-officer-trial` | FoundingOfficerTrial | src/pages/FoundingOfficerTrial.tsx | Founding officer trial | ⚠️ Partial |
| 11 | `/account/earnings` | EarningsDashboard | src/pages/EarningsDashboard.tsx | Public earnings page | ⚠️ Partial |
| 12 | `/payout-status` | PayoutStatus | src/pages/PayoutStatus.tsx | Payout status tracking | ✅ Working |
| 13 | `/safety` | Safety | src/pages/Safety.tsx | Safety landing page | ✅ Working |
| 14 | `/explore` | ExploreFeed | src/pages/ExploreFeed.tsx | Explore feed of broadcasts | ✅ Working |
| 15 | `/live-swipe` | StreamSwipePage | src/pages/StreamSwipePage.tsx | Tinder-style stream browser | ⚠️ Partial |
| 16 | `/embed/:id` | EmbedPage | src/pages/broadcast/EmbedPage.tsx | Broadcast embed player | ✅ Working |
| 17 | `/hytrogaming` | HytroGaming | src/pages/gaming/HytroGaming.tsx | Hytro gaming hub | ✅ Working |
| 18 | `/hytrogaming/apply` | HytroGamingApply | src/pages/gaming/HytroGamingApply.tsx | Hytro application | ✅ Working |
| 19 | `/hytrogaming/contract/:id` | HytroGamingContract | src/pages/gaming/HytroGamingContract.tsx | Hytro contract signing | ✅ Working |
| 20 | `/hytro/:id` | HytroViewerPage | src/pages/gaming/HytroViewerPage.tsx | Hytro stream viewer | ✅ Working |
| 21 | `/dev/theme-preview` | ThemePreviewPage | src/pages/dev/ThemePreviewPage.tsx | Dev: theme previews | ❓ Dev only |
| 22 | `/dev/homepage-preview` | HomepageBackgroundShowcase | src/pages/dev/HomepageBackgroundShowcase.tsx | Dev: homepage previews | ❓ Dev only |
| 23 | `/agencies` | AgenciesPage | src/pages/agencies (index.tsx) | Agency directory (public) | ✅ Working |
| 24 | `/agencies/create` | CreateAgencyPage | src/pages/agencies/CreateAgencyPage.tsx | Agency creation | ✅ Working |
| 25 | `/agency/:agencyIdOrSlug` | AgencyProfilePage | src/pages/agency/[agencyId]/index.tsx | Agency profile page | ✅ Working |
| 26 | `/agency/:agencyIdOrSlug/roster` | AgencyProfilePage | src/pages/agency/[agencyId]/index.tsx | Agency roster | ✅ Working (same comp) |
| 27 | `/agency/:agencyIdOrSlug/goals` | AgencyProfilePage | src/pages/agency/[agencyId]/index.tsx | Agency goals | ✅ Working (same comp) |
| 28 | `/agency-apply/:agencyIdOrSlug` | AgencyApplyPage | src/pages/agency-apply/[agencyId]/index.tsx | Agency application | ✅ Working |
| 29 | `/apply` | ApplicationPage | src/pages/ApplicationPage.tsx | General application | ✅ Working |
| 30 | `/careers` | Career | src/pages/Careers.tsx | Careers listing | ✅ Working |
| 31 | `/auctions` | AuctionsPage | src/pages/AuctionsPage.tsx | Auction listing (public) | ✅ Working |
| 32 | `/auctions/:showId` | LiveAuctionRoom | src/pages/auction/LiveAuctionRoom.tsx | Auction room (public) | ✅ Working |
| 33 | `/shareathon` | ShareAThonLanding | src/pages/shareathon/ShareAThonLanding.tsx | Share-A-Thon landing | ✅ Working |
| 34 | `/shareathon/leaderboard` | ShareAThonLeaderboard | src/pages/shareathon/ShareAThonLeaderboard.tsx | Share-A-Thon leaderboard | ✅ Working |

### LEGAL & POLICY ROUTES (Public)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 35 | `/legal` | PolicyCenter | src/pages/PolicyCenter.tsx | Policy index | ✅ Working |
| 36 | `/legal/terms` | TermsOfServiceLegal | src/pages/legal/TermsOfServiceLegal.tsx | Terms of service | ✅ Working |
| 37 | `/legal/privacy` | PrivacyPolicyLegal | src/pages/legal/PrivacyPolicyLegal.tsx | Privacy policy | ✅ Working |
| 38 | `/legal/refunds` | RefundPolicyLegal | src/pages/legal/RefundPolicyLegal.tsx | Refund policy | ✅ Working |
| 39 | `/legal/refund` | RefundPolicyLegal | src/pages/legal/RefundPolicyLegal.tsx | Alias → Refunds | ✅ Working |
| 40 | `/legal/payouts` | PayoutPolicyLegal | src/pages/legal/PayoutPolicyLegal.tsx | Payout policy | ✅ Working |
| 41 | `/legal/safety` | SafetyGuidelinesLegal | src/pages/legal/SafetyGuidelinesLegal.tsx | Safety guidelines | ✅ Working |
| 42 | `/legal/creator-earnings` | CreatorEarnings | src/pages/legal/CreatorEarnings.tsx | Creator earnings rules | ✅ Working |
| 43 | `/legal/gambling-disclosure` | GamblingDisclosure | src/pages/legal/GamblingDisclosure.tsx | Gambling disclosure | ✅ Working |
| 44 | `/categories/:slug/live` | SEOCategoryPage | src/pages/seo/CategoryPage.tsx | Category live | ✅ Working |

### SEO ROUTES (Public, Indexable)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 45 | `/about` | SEOAboutPage | src/pages/seo/AboutPage.tsx | About page (public) | ✅ Working |
| 46 | `/broadcasting` | SEOBroadcastingPage | src/pages/seo/BroadcastingPage.tsx | Broadcasting info | ✅ Working |
| 47 | `/categories` | SEOCategoriesPage | src/pages/seo/CategoriesPage.tsx | Category listing | ✅ Working |
| 48 | `/creators` | SEOCreatorsPage | src/pages/seo/CreatorsPage.tsx | Creators listing | ✅ Working |
| 49 | `/go-live` | SEOGoLivePage | src/pages/seo/GoLivePage.tsx | Go live guide | ✅ Working |
| 50 | `/seo-government` | SEOGovernmentPage | src/pages/seo/GovernmentPage.tsx | Government info | ✅ Working |
| 51 | `/categories/:slug` | SEOCategoryPage | src/pages/seo/CategoryPage.tsx | Category detail | ✅ Working |
| 52 | `/top-creators` | SEOTopCreatorsPage | src/pages/seo/TopCreatorsPage.tsx | Top creators | ✅ Working |
| 53 | `/trending` | SEOTrendingPage | src/pages/seo/TrendingPage.tsx | Trending page | ✅ Working |

### AUTHENTICATED ROUTES (RequireAuth)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 54 | `/home` | → Navigate to / | — | Redirect | ✅ Working |
| 55 | `/agency-dashboard` | AgencyDashboard | src/pages/agency-dashboard/index.tsx | Agency management dashboard | ✅ Working |
| 56 | `/agency-hr-dashboard` | AgencyHRDashboard | src/pages/agency-hr-dashboard/index.tsx | Agency HR dashboard | ✅ Working |
| 57 | `/broadcast/setup` | SetupPage | src/pages/broadcast/SetupPage.tsx | Broadcast setup wizard | ✅ Working |
| 58 | `/broadcast/setup/gaming` | GamingSetupPage | src/pages/broadcast/GamingSetupPage.tsx | Gaming broadcast setup | ✅ Working |
| 59 | `/broadcast/setup/gaming/analytics` | GamingAnalytics | src/pages/broadcast/gaming/GamingAnalytics.tsx | Gaming analytics | ✅ Working |
| 60 | `/broadcast/setup/gaming/community` | GamingCommunity | src/pages/broadcast/gaming/GamingCommunity.tsx | Gaming community | ✅ Working |
| 61 | `/broadcast/setup/gaming/monetization` | GamingMonetization | src/pages/broadcast/gaming/GamingMonetization.tsx | Gaming monetization | ✅ Working |
| 62 | `/broadcast/setup/gaming/store` | GamingStore | src/pages/broadcast/gaming/GamingStore.tsx | Gaming store | ✅ Working |
| 63 | `/gaming/watch/:streamId` | HytroViewerPage | src/pages/gaming/HytroViewerPage.tsx | Hytro viewer | ✅ Working |
| 64 | `/broadcast/:id` | BroadcastRouter | src/pages/broadcast/BroadcastRouter.tsx | Broadcast routing hub | ✅ Working |
| 65 | `/watch/:id` | BroadcastRouter | src/pages/broadcast/BroadcastRouter.tsx | Watch stream redirect | ✅ Working |
| 66 | `/kick-fee/:streamId` | KickFeePage | src/pages/broadcast/KickFeePage.tsx | Kick fee payment | ⚠️ Partial |
| 67 | `/broadcast/summary/:streamId` | StreamSummary | src/pages/broadcast/StreamSummary.tsx | Stream summary | ✅ Working |
| 68 | `/president` | PresidentPage | src/pages/President.tsx | President landing | ✅ Working |
| 69 | `/president/dashboard` | PresidentDashboard | src/pages/president/PresidentDashboard.tsx | President dashboard | ✅ Working |
| 70 | `/president/secretary` | SecretaryDashboard | src/pages/president/SecretaryDashboard.tsx | Secretary dashboard | ✅ Working |
| 71 | `/president/treasury` | TreasuryDashboard | src/pages/TreasuryDashboard.tsx | Treasury management | ⚠️ Partial |
| 72 | `/prosecutor` | ProsecutorDashboard | src/pages/prosecutor/ProsecutorDashboard.tsx | Prosecutor dashboard | ✅ Working |
| 73 | `/live` | ExploreFeed | src/pages/ExploreFeed.tsx | Live explore (legacy) | ✅ Working (legacy) |
| 74 | `/match` | MatchPage | src/pages/MatchPage.tsx | Matchmaking | ✅ Working |
| 75 | `/city-registry` | CityRegistry | src/pages/CityRegistry.tsx | City registry | ✅ Working |
| 76 | `/city-registry/advertise` | AdvertisePage | src/pages/city-registry/AdvertisePage.tsx | City advertise | ✅ Working |
| 77 | `/universe-event` | UniverseEventPage | src/pages/UniverseEventPage.tsx | Universe event | ✅ Working |
| 78 | `/tcnn` | TCNNMainPage | src/pages/tcnn/TCNNMainPage.tsx | TCNN news main | ✅ Working |
| 79 | `/tcnn/article/:id` | ArticleReader | src/pages/tcnn/ArticleReader.tsx | Article reading | ✅ Working |
| 80 | `/tcnn/dashboard` | TCNNInternalDashboard | src/pages/tcnn/TCNNInternalDashboard.tsx | TCNN internal dashboard | ✅ Working |
| 81 | `/tcnn/setup` | TCNNSetupPage | src/pages/tcnn/TCNNSetupPage.tsx | TCNN broadcaster setup | ✅ Working |
| 82 | `/tcnn/broadcaster` | TCNNBroadcasterPage | src/pages/tcnn/TCNNBroadcasterPage.tsx | TCNN broadcasting | ✅ Working |
| 83 | `/tcnn/broadcaster/:streamId` | TCNNBroadcasterPage | src/pages/tcnn/TCNNBroadcasterPage.tsx | TCNN stream broadcast | ✅ Working |
| 84 | `/tcnn/viewer/:streamId` | TCNNViewerPage | src/pages/tcnn/TCNNViewerPage.tsx | TCNN viewer | ✅ Working |
| 85 | `/call/:roomId/:type/:userId` | Call | src/pages/Call.tsx | Video/voice call | ✅ Working |
| 86 | `/notifications` | Notifications | src/pages/Notifications.tsx | Notification center | ✅ Working |
| 87 | `/following` | Following | src/pages/Following.tsx | Following list | ✅ Working |
| 88 | `/following/:userId` | Following | src/pages/Following.tsx | Following detail | ✅ Working |
| 89 | `/trollifications` | Trollifications | src/pages/Trollifications.tsx | Trollification system | ⚠️ Partial |
| 90 | `/trollifieds` | Trollifieds | src/pages/Trollifieds.tsx | Trollified items | ⚠️ Partial |
| 91 | `/marketplace` | Marketplace | src/pages/Marketplace.tsx | Marketplace | ✅ Working |
| 92 | `/marketplace/orders` | Marketplace | src/pages/Marketplace.tsx | Marketplace orders | ✅ Working |
| 93 | `/marketplace/sales` | Marketplace | src/pages/Marketplace.tsx | Marketplace sales | ✅ Working |
| 94 | `/pool` | PublicPool | src/pages/PublicPool.tsx | Public pool | ✅ Working |
| 95 | `/troll-games` | TrollGamesPage | src/pages/TrollGamesPage.tsx | Troll games hub | ✅ Working |
| 96 | `/troll-games/queue` | TrollGamesPage | src/pages/TrollGamesPage.tsx | Game queue | ✅ Working |
| 97 | `/troll-games/live` | TrollGamesPage | src/pages/TrollGamesPage.tsx | Live games | ✅ Working |
| 98 | `/troll-games/match/:matchId` | TrollGamesPage | src/pages/TrollGamesPage.tsx | Game match | ✅ Working |
| 99 | `/troll-games/:gameType/:matchId` | TrollGamesPage | src/pages/TrollGamesPage.tsx | Game by type | ✅ Working |
| 100 | `/troll-games/giveaways` | GiveawaysPage | src/pages/GiveawaysPage.tsx | Giveaways | ✅ Working |
| 101 | `/troll-wheel` | TrollWheel | src/pages/TrollWheel.tsx | Spin the wheel | ✅ Working |
| 102 | `/ktauto` | CarDealership | src/pages/CarDealership.tsx | Car dealership | ✅ Working |
| 103 | `/garage` | GaragePage | src/pages/GaragePage.tsx (lazy) | Garage | ✅ Working |
| 104 | `/vehicle-transactions` | VehicleTransactionsPage | src/pages/VehicleTransactionsPage.tsx (lazy) | Vehicle transactions | ⚠️ Partial |
| 105 | `/shop/:username` | ShopView | src/pages/ShopView.tsx | User shop | ✅ Working |
| 106 | `/inventory` | UserInventory | src/pages/UserInventory.tsx | User inventory | ✅ Working |
| 107 | `/troting` | Troting | src/pages/Troting.tsx | Troting/ranked battles | ✅ Working |
| 108 | `/profile/settings` | ProfileSettings | src/pages/ProfileSettings.tsx | Profile settings | ✅ Working |
| 109 | `/profile/delete` | DeleteAccount | src/pages/DeleteAccount.tsx | Account deletion | ✅ Working |
| 110 | `/bank` | TrollBank | src/pages/TrollBank.tsx | Troll bank | ✅ Working |
| 111 | `/leaderboard` | Leaderboard | src/pages/Leaderboard.tsx | Leaderboard | ✅ Working |
| 112 | `/credit-scores` | CreditScorePage | src/pages/CreditScorePage.tsx | Credit scores | ✅ Working |
| 113 | `/support` | Support | src/pages/Support.tsx (lazy) | Support page | ✅ Working |
| 114 | `/jail` | JailPage | src/pages/JailPage.tsx (lazy) | Jail page | ✅ Working |
| 115 | `/inmates` | InmatesPage | src/pages/InmatesPage.tsx | Inmates listing | ✅ Working |
| 116 | `/jail/appeal` | JailAppealPage | src/pages/JailAppealPage.tsx.tsx (lazy) | Jail appeal | ✅ Working |
| 117 | `/wall` | TrollCityWall | src/pages/TrollCityWall.tsx | Troll city wall | ✅ Working |
| 118 | `/wall/:postId` | WallPostPage | src/pages/WallPostPage.tsx | Wall post detail | ✅ Working |
| 119 | `/profile/setup` | ProfileSetup | src/pages/ProfileSetup.tsx | Profile setup | ✅ Working |
| 120 | `/profile/id/:userId` | Profile | src/pages/Profile.tsx | User profile by ID | ✅ Working |
| 121 | `/profile/:username` | Profile | src/pages/Profile.tsx | User profile by username | ✅ Working |
| 122 | `/search` | SearchPage | src/pages/SearchPage.tsx | Search | ✅ Working |
| 123 | `/blocked-users` | BlockedUsers | src/pages/BlockedUsers.tsx | Blocked users | ✅ Working |
| 124 | `/district/:districtName` | DistrictTour | src/pages/DistrictTour.tsx | District tours | ✅ Working |
| 125 | `/living` | LivingPage | src/pages/UnderConstructionPage | Under construction | ❌ Under Construction |
| 126 | `/map` | MapPage | src/pages/MapPage.tsx | City map | ✅ Working |
| 127 | `/neighborhood-map` | NeighborhoodMapHub | src/pages/NeighborhoodMapHub.tsx | Neighborhood map | ✅ Working |
| 128 | `/neighborhood-setup` | NeighborhoodOnboarding | src/pages/NeighborhoodOnboarding.tsx | Neighborhood setup | ✅ Working |
| 129 | `/driver-test` | DriverTest | src/pages/DriverTest.tsx | Driver's test | ✅ Working |
| 130 | `/insurance` | InsurancePage | src/pages/InsurancePage.tsx | Insurance | ✅ Working |
| 131 | `/church` | ChurchPage | src/pages/ChurchPage.tsx | Church main | ✅ Working |
| 132 | `/church/live/:sessionId` | ChurchLivePage | src/pages/church/ChurchLivePage.tsx (lazy) | Church live session | ✅ Working |
| 133 | `/church/pastor` | PastorDashboard | src/pages/church/PastorDashboard.tsx | Pastor dashboard | ✅ Working |
| 134 | `/attorney` | AttorneyDashboard | src/pages/attorney/AttorneyDashboard.tsx | Attorney dashboard | ✅ Working |
| 135 | `/ceo-assistant-dashboard` | CEOAssistantDashboard | src/pages/ceo-assistant-dashboard/index.tsx | CEO assistant | ✅ Working |
| 136 | `/noah-assistant-dashboard` | NoahAssistantDashboard | src/pages/noah-assistant-dashboard/index.tsx | Noah assistant | ✅ Working |
| 137 | `/live/command-center/:streamId` | LiveCommandCenter | src/pages/live/LiveCommandCenter.tsx | Live command center | ⚠️ Partial |
| 138 | `/live/overlay/:streamId` | LiveStreamOverlay | src/pages/live/LiveStreamOverlay.tsx | Live overlay | ⚠️ Partial |
| 139 | `/settings/audio` | AudioSettings | src/pages/live/AudioSettings.tsx | Audio settings | ✅ Working |
| 140 | `/join` | JoinPage | src/pages/Join.tsx | Join page | ✅ Working |
| 141 | `/kick-fee` | KickFee | src/pages/KickFee.tsx | Kick fee (general) | ✅ Working |
| 142 | `/troll-court/session` | TrollCourtSession | src/pages/TrollCourtSession.tsx | Troll court session | ✅ Working |
| 143 | `/live/:streamId` | BroadcastRouter | src/pages/broadcast/BroadcastRouter.tsx | Live stream | ✅ Working |
| 144 | `/stream/:id` | BroadcastRouter | src/pages/broadcast/BroadcastRouter.tsx | Stream redirect | ✅ Working |
| 145 | `/stream/:streamId` | BroadcastRouter | src/pages/broadcast/BroadcastRouter.tsx | Stream redirect | ✅ Working |
| 146 | `/troll-court` | TrollCourt | src/pages/TrollCourt.tsx | Troll court | ✅ Working |
| 147 | `/troll-court/watch/:sessionId` | CourtViewerPage | src/pages/CourtViewerPage.tsx | Court viewer | ✅ Working |
| 148 | `/court/:courtId` | CourtRoom | src/pages/CourtRoom.tsx | Court room | ✅ Working |
| 149 | `/meeting/:meetingId` | TeamMeetingRoom | src/pages/TeamMeetingRoom.tsx | Team meeting | ✅ Working |
| 150 | `/team-meeting/:meetingId` | TeamMeetingRoom | src/pages/TeamMeetingRoom.tsx | Team meeting alias | ✅ Working |
| 151 | `/tromail` | TromailPage | src/pages/tromail/TromailPage.tsx | Tromail email | ✅ Working |
| 152 | `/utromail` | UtromailPage | src/pages/utromail/UtromailPage.tsx | U-TroMail email | ✅ Working |
| 153 | `/utromail/thread/:threadId` | UtromailPage | src/pages/utromail/UtromailPage.tsx | U-TroMail thread | ✅ Working |
| 154 | `/utromail/compose` | UtromailPage | src/pages/utromail/UtromailPage.tsx | U-TroMail compose | ✅ Working |
| 155 | `/utromail/settings` | UtromailPage | src/pages/utromail/UtromailPage.tsx | U-TroMail settings | ✅ Working |
| 156 | `/podcast` | PodcastCentral | src/pages/PodcastCentral.tsx | Podcast hub | ✅ Working |
| 157 | `/podcast/:id` | PodcastRoom | src/pages/PodcastRoom.tsx | Podcast room | ✅ Working |
| 158 | `/onboarding/creator` | CreatorOnboarding | src/pages/CreatorOnboarding.tsx | Creator onboarding | ✅ Working |
| 159 | `/creator-switch` | CreatorSwitchProgram | src/pages/CreatorSwitchProgram.tsx | Creator switch program | ✅ Working |
| 160 | `/pride-shop` | PrideShop | src/pages/PrideShop.tsx | Pride shop | ✅ Working |
| 161 | `/store` | CoinStore | src/pages/CoinStore.tsx | Coin store | ✅ Working |
| 162 | `/coins` | CoinStore | src/pages/CoinStore.tsx | Coin store alias | ✅ Working |
| 163 | `/coins/complete` | CoinsComplete | src/pages/CoinsComplete.tsx | Coin purchase complete | ✅ Working |
| 164 | `/wallet` | WalletPage | src/pages/Wallet.tsx | Wallet | ✅ Working |
| 165 | `/stats` | StatsPage | src/pages/Stats.tsx | Stats page | ✅ Working |
| 166 | `/payouts/setup` | PayoutSetupPage | src/pages/PayoutSetupPage.tsx | Payout setup | ✅ Working |
| 167 | `/payouts/request` | PayoutRequest | src/pages/PayoutRequest.tsx | Payout request | ✅ Working |
| 168 | `/payment/callback` | PaymentCallback | src/pages/PaymentCallback.tsx | Payment callback | ✅ Working |
| 169 | `/earnings` | EarningsDashboard | src/pages/EarningsDashboard.tsx | Earnings | ✅ Working |
| 170 | `/my-earnings` | MyEarnings | src/pages/MyEarnings.tsx | My earnings | ✅ Working |
| 171 | `/bonuses` | BonusesPage | src/pages/Bonuses.tsx | Bonuses | ✅ Working |
| 172 | `/cashout` | CashoutPage | src/pages/CashoutPage.tsx | Cashout | ✅ Working |
| 173 | `/cashout-request` | CashoutRequestPage | src/pages/CashoutRequestPage.tsx | Cashout request | ✅ Working |
| 174 | `/withdraw` | Withdraw | src/pages/Withdraw.tsx | Withdraw | ✅ Working |
| 175 | `/transactions` | TransactionHistory | src/pages/TransactionHistory.tsx | Transaction history | ✅ Working |
| 176 | `/shop-partner` | ShopPartnerPage | src/pages/ShopPartnerPage.tsx | Shop partner | ✅ Working |
| 177 | `/sell` | SellOnTrollCity | src/pages/SellOnTrollCity.tsx | Sell on Troll City | ✅ Working |
| 178 | `/seller/orders` | SellerOrders | src/pages/SellerOrders.tsx | Seller orders | ✅ Working |
| 179 | `/my-orders` | MyOrders | src/pages/MyOrders.tsx | My orders | ✅ Working |
| 180 | `/seller/earnings` | ShopEarnings | src/pages/ShopEarnings.tsx | Shop earnings | ✅ Working |
| 181 | `/family` | → Navigate to /family/browse | — | Family redirect | ✅ Working |
| 182 | `/family/browse` | FamilyBrowse | src/pages/FamilyBrowse.tsx | Family browse | ✅ Working |
| 183 | `/family/create` | FamilyBrowse | src/pages/FamilyBrowse.tsx | Family create | ✅ Working |
| 184 | `/family/city` | TrollFamilyCity | src/pages/TrollFamilyCity.tsx | Family city | ✅ Working |
| 185 | `/family/profile/:id` | FamilyProfilePage | src/pages/FamilyProfilePage.tsx | Family profile | ✅ Working |
| 186 | `/family/chat/:familyId` | FamilyChatPage | src/pages/FamilyChatPage.tsx | Family chat | ✅ Working |
| 187 | `/family/wars` | FamilyWarsPage | src/pages/FamilyChatPage.tsx | Family wars | ⚠️ Partial |
| 188 | `/family/home` | TrollFamilyHome | src/pages/TrollFamilyHome.tsx | Family home | ✅ Working |
| 189 | `/family/wars-hub` | FamilyWarsHub | src/pages/FamilyWarsHub.tsx | Family wars hub | ✅ Working |
| 190 | `/family/leaderboard` | FamilyLeaderboard | src/pages/FamilyLeaderboard.tsx | Family leaderboard | ✅ Working |
| 191 | `/family/shop` | FamilyShop | src/pages/FamilyShop.tsx | Family shop | ✅ Working |
| 192 | `/government` | Government | src/pages/Government.tsx | Government | ✅ Working |
| 193 | `/government/streams` | GovernmentStreams | src/pages/government/GovernmentStreams.tsx | Government streams | ✅ Working |
| 194 | `/lead-officer` | LeadOfficerDashboard | src/pages/lead-officer/LeadOfficerDashboard.tsx | Lead officer dashboard | ✅ Working |
| 195 | `/officer/lounge` | TrollOfficerLounge | src/pages/TrollOfficerLounge.tsx | Officer lounge | ✅ Working |
| 196 | `/officer/moderation` | OfficerModeration | src/pages/OfficerModeration.tsx | Officer moderation | ✅ Working |
| 197 | `/officer/report/:id` | ReportDetailsPage | src/pages/ReportDetailsPage.tsx | Report details | ✅ Working |
| 198 | `/officer/scheduling` | OfficerScheduling | src/pages/OfficerScheduling.tsx | Officer scheduling | ✅ Working |
| 199 | `/officer/dashboard` | OfficerDashboard | src/pages/officer/OfficerDashboard.tsx | Officer dashboard | ✅ Working |
| 200 | `/shareathon/submit` | ShareAThonSubmit | src/pages/shareathon/ShareAThonSubmit.tsx | Share-A-Thon submit | ✅ Working |

### AUCTION ROUTES (Authenticated + Role-gated)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 201 | `/auctions/studio` | AuctionStudio | src/pages/auction/AuctionStudio.tsx | Auction studio | ✅ Working |
| 202 | `/auctions/studio/:showId/lots` | AuctionStudioLots | src/pages/auction/AuctionStudioLots.tsx | Auction lots | ✅ Working |
| 203 | `/auctions/studio/:showId/live` | AuctioneerDashboard | src/pages/auction/AuctioneerDashboard.tsx | Auctioneer live | ✅ Working |
| 204 | `/auctions/my-shows` | MyAuctionShows | src/pages/auction/MyAuctionShows.tsx | My auction shows | ✅ Working |
| 205 | `/auctions/reports` | AuctionReports | src/pages/auction/AuctionReports.tsx | Auction reports | ✅ Working |
| 206 | `/auctions/applications` | AdminAuctionApps | src/pages/auction/AdminAuctionApps.tsx | Auction applications | ✅ Working |
| 207 | `/auctions/bidders` | AuctionBidders | src/pages/auction/AuctionBidders.tsx | Auction bidders | ✅ Working |
| 208 | `/auctions/sales` | AuctionSales | src/pages/auction/AuctionSales.tsx | Auction sales | ✅ Working |
| 209 | `/auctions/analytics` | AuctionAnalytics | src/pages/auction/AuctionAnalytics.tsx | Auction analytics | ✅ Working |
| 210 | `/auctions/settings` | AuctionSettings | src/pages/auction/AuctionSettings.tsx | Auction settings | ✅ Working |
| 211 | `/auctions/inventory` | AuctionInventory | src/pages/auction/AuctionInventory.tsx | Auction inventory | ✅ Working |
| 212 | `/auctions/orders` | AuctionOrderManagement | src/pages/auction/AuctionOrderManagement.tsx | Auction orders | ✅ Working |
| 213 | `/auctions/packing` | PackingStation | src/pages/auction/PackingStation.tsx | Packing station | ✅ Working |
| 214 | `/auctions/devices` | DeviceManagement | src/pages/auction/DeviceManagement.tsx | Device management | ✅ Working |

### ACADEMY ROUTES (Authenticated)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 215 | `/academy` | AcademyHomePage | src/pages/academy/AcademyHomePage.tsx | Academy home | ✅ Working |
| 216 | `/academy/courses` | CourseCatalogPage | src/pages/academy/CourseCatalogPage.tsx | Course catalog | ✅ Working |
| 217 | `/academy/course/:slug` | CourseDetailPage | src/pages/academy/CourseDetailPage.tsx | Course detail | ✅ Working |
| 218 | `/academy/verify` | VerifyCertificatePage | src/pages/academy/VerifyCertificatePage.tsx | Verify certificate | ✅ Working |
| 219 | `/academy/teacher/apply` | TeacherApplyPage | src/pages/academy/TeacherApplyPage.tsx | Teacher application | ✅ Working |
| 220 | `/academy/teacher/dashboard` | TeacherDashboardPage | src/pages/academy/TeacherDashboardPage.tsx | Teacher dashboard | ✅ Working |
| 221 | `/academy/teacher/course/new` | TeacherCoursePage | src/pages/academy/TeacherCoursePage.tsx | New teacher course | ✅ Working |
| 222 | `/academy/teacher/course/:courseId` | TeacherCoursePage | src/pages/academy/TeacherCoursePage.tsx | Teacher course edit | ✅ Working |
| 223 | `/academy/grades` | AcademyTranscriptPage | src/pages/academy/AcademyTranscriptPage.tsx | Academy grades | ✅ Working |
| 224 | `/academy/certificates` | AcademyCertificatesPage | src/pages/academy/AcademyCertificatesPage.tsx | Academy certificates | ✅ Working |
| 225 | `/academy/transcript` | AcademyTranscriptPage | src/pages/academy/AcademyTranscriptPage.tsx | Transcript | ✅ Working |
| 226 | `/academy/coins` | AcademyCoinsPage | src/pages/academy/AcademyCoinsPage.tsx | Academy coins | ✅ Working |
| 227 | `/academy/admissions` | AcademyAdmissionsPage | src/pages/academy/AdmissionsDashboardPage.tsx | Admissions | ✅ Working |
| 228 | `/academy/classroom` | AcademyClassroomPage | src/pages/academy/AcademyClassroomPage.tsx | Classroom | ✅ Working |
| 229 | `/academy/classroom/:courseId` | AcademyClassroomPage | src/pages/academy/AcademyClassroomPage.tsx | Classroom by course | ✅ Working |
| 230 | `/academy/admin` | AcademyAdminPage | src/pages/academy/AcademyAdminPage.tsx | Academy admin | ✅ Working |
| 231 | `/academy/assignment/new` | AssignmentCreatePage | src/pages/academy/AssignmentCreatePage.tsx | New assignment | ✅ Working |
| 232 | `/academy/assignment/edit/:assignmentId` | AssignmentCreatePage | src/pages/academy/AssignmentCreatePage.tsx | Edit assignment | ✅ Working |
| 233 | `/academy/assignment/grade/:assignmentId` | AssignmentGradingPage | src/pages/academy/AssignmentGradingPage.tsx | Grade assignment | ✅ Working |
| 234 | `/academy/course/:slug/assignments` | AssignmentStudentPage | src/pages/academy/AssignmentStudentPage.tsx | Student assignments | ✅ Working |
| 235 | `/academy/course/:slug/quiz/:quizId` | QuizTakePage | src/pages/academy/QuizTakePage.tsx | Take quiz | ✅ Working |
| 236 | `/academy/quiz/new` | QuizBuilderPage | src/pages/academy/QuizBuilderPage.tsx | New quiz | ✅ Working |
| 237 | `/academy/quiz/new/:courseId` | QuizBuilderPage | src/pages/academy/QuizBuilderPage.tsx | New quiz for course | ✅ Working |
| 238 | `/academy/attendance/:courseId` | AttendancePage | src/pages/academy/AttendancePage.tsx | Attendance | ✅ Working |
| 239 | `/academy/attendance/:courseId/:sessionId` | AttendancePage | src/pages/academy/AttendancePage.tsx | Attendance session | ✅ Working |
| 240 | `/academy/pathway/:pathwayId` | PathwayDetailPage | src/pages/academy/PathwayDetailPage.tsx | Pathway detail | ✅ Working |
| 241 | `/academy/loans` | LoanServicingPage | src/pages/academy/LoanServicingPage.tsx | Loan servicing | ✅ Working |
| 242 | `/academy/teacher/revenue` | TeacherRevenuePage | src/pages/academy/TeacherRevenuePage.tsx | Teacher revenue | ✅ Working |
| 243 | `/academy/course/:slug/communication` | CommunicationCenterPage | src/pages/academy/CommunicationCenterPage.tsx | Communication center | ✅ Working |
| 244 | `/academy/transcript/official` | TranscriptPage | src/pages/academy/TranscriptPage.tsx | Official transcript | ✅ Working |
| 245 | `/academy/accreditation` | AccreditationPage | src/pages/academy/AccreditationPage.tsx | Accreditation | ✅ Working |
| 246 | `/academy/admin/teachers` | TeacherManagementPage | src/pages/academy/TeacherManagementPage.tsx | Teacher management | ✅ Working |
| 247 | `/academy/teachers` | TeacherDirectoryPage | src/pages/academy/TeacherDirectoryPage.tsx | Teacher directory | ✅ Working |
| 248 | `/academy/assignments` | AssignmentsListPage | src/pages/academy/AssignmentsListPage.tsx | Assignments list | ✅ Working |

### ADMIN ROUTES (Role-gated: ADMIN)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 249 | `/admin` | AdminDashboard | src/pages/admin/AdminDashboard.tsx | Main admin dashboard | ✅ Working |
| 250 | `/admin/creator-approvals` | CreatorSwitchApprovals | src/pages/admin/components/CreatorSwitchApprovals.tsx | Creator approvals | ✅ Working |
| 251 | `/admin/officer-operations` | OfficerOperations | src/pages/admin/OfficerOperations.tsx | Officer operations | ✅ Working |
| 252 | `/store-debug` | StoreDebug | src/pages/admin/StoreDebug.tsx | Store debug | ✅ Working |
| 253 | `/admin-mobile` | MobileAdminDashboard | src/pages/admin/MobileAdminDashboard.tsx | Mobile admin | ✅ Working |
| 254 | `/admin/officer-reports` | AdminOfficerReports | src/pages/admin/AdminOfficerReports.tsx | Officer reports | ✅ Working |
| 255 | `/admin/earnings` | AdminEarningsDashboard | src/pages/admin/AdminEarningsDashboard.tsx | Admin earnings | ✅ Working |
| 256 | `/admin/payments` | PaymentsDashboard | src/pages/admin/PaymentsDashboard.tsx | Payments | ✅ Working |
| 257 | `/admin/economy` | EconomyDashboard | src/pages/admin/EconomyDashboard.tsx | Economy | ✅ Working |
| 258 | `/admin/tax-reviews` | TaxReviewPanel | src/pages/admin/TaxReviewPanel.tsx | Tax reviews | ✅ Working |
| 259 | `/tax/upload` | TaxUpload | src/pages/TaxUpload.tsx | Tax upload | ✅ Working |
| 260 | `/admin/referrals` | ReferralBonusPanel | src/pages/admin/ReferralBonusPanel.tsx | Referral bonuses | ✅ Working |
| 261 | `/admin/payouts` | AdminPayoutDashboard | src/pages/admin/components/AdminPayoutDashboard.tsx | Payout dashboard | ✅ Working |
| 262 | `/admin/officers-live` | AdminLiveOfficersTracker | src/pages/admin/AdminLiveOfficersTracker.tsx | Live officers | ✅ Working |
| 263 | `/admin/verified-users` | AdminVerifiedUsers | src/pages/admin/AdminVerifiedUsers.tsx | Verified users | ✅ Working |
| 264 | `/admin/verification` | AdminVerificationReview | src/pages/admin/AdminVerificationReview.tsx | Verification review | ✅ Working |
| 265 | `/admin/applications` | ApplicationsPage | src/pages/admin/Applications.tsx | Applications | ✅ Working |
| 266 | `/admin/docs/policies` | AdminPoliciesDocs | src/pages/admin/AdminPoliciesDocs.tsx | Policy docs | ✅ Working |
| 267 | `/admin/marketplace` | AdminMarketplace | src/pages/admin/AdminMarketplace.tsx | Admin marketplace | ✅ Working |
| 268 | `/admin/executive-secretaries` | ExecutiveSecretaries | src/pages/admin/ExecutiveSecretaries.tsx | Executive secretaries | ✅ Working |
| 269 | `/admin/executive-intake` | ExecutiveIntake | src/pages/admin/ExecutiveIntake.tsx | Executive intake | ✅ Working |
| 270 | `/admin/executive-reports` | ExecutiveReports | src/pages/admin/ExecutiveReports.tsx | Executive reports | ✅ Working |
| 271 | `/admin/troll-town-deeds` | AdminTrollTownDeeds | src/pages/admin/AdminTrollTownDeeds.tsx | Town deeds | ✅ Working |
| 272 | `/admin/cashout-manager` | CashoutManager | src/pages/admin/CashoutManager.tsx | Cashout manager | ✅ Working |
| 273 | `/admin/cashout/:id` | AdminCashoutDetailPage | src/pages/admin/CashoutDetailPage.tsx | Cashout detail | ✅ Working |
| 274 | `/admin/officer-management` | OfficerManager | src/pages/admin/OfficerManager.tsx | Officer management | ✅ Working |
| 275 | `/secretary` | SecretaryConsole | src/pages/secretary/SecretaryConsole.tsx | Secretary console | ✅ Working |
| 276 | `/admin/role-management` | RoleManagement | src/pages/admin/RoleManagement.tsx | Role management | ✅ Working |
| 277 | `/admin/media-library` | MediaLibrary | src/pages/admin/MediaLibrary.tsx | Media library | ✅ Working |
| 278 | `/admin/chat-moderation` | ChatModeration | src/pages/admin/ChatModeration.tsx | Chat moderation | ✅ Working |
| 279 | `/admin/announcements` | Announcements | src/pages/admin/Announcements.tsx | Announcements | ✅ Working |
| 280 | `/admin/send-notifications` | SendNotifications | src/pages/admin/SendNotifications.tsx | Send notifications | ✅ Working |
| 281 | `/admin/export-data` | ExportData | src/pages/admin/ExportData.tsx | Export data | ✅ Working |
| 282 | `/admin/user-search` | UserSearch | src/pages/admin/UserSearch.tsx | User search | ✅ Working |
| 283 | `/admin/reports-queue` | ReportsQueue | src/pages/admin/ReportsQueue.tsx | Reports queue | ✅ Working |
| 284 | `/admin/stream-monitor` | StreamMonitorPage | src/pages/admin/StreamMonitorPage.tsx | Stream monitor | ✅ Working |
| 285 | `/admin/night-watch` | NightWatchDashboard | src/pages/admin/NightWatchDashboard.tsx | Night watch | ✅ Working |
| 286 | `/admin/voting` | TrotingAdminPage | src/pages/admin/TrotingAdminPage.tsx | Voting admin | ✅ Working |
| 287 | `/admin/payment-logs` | PaymentLogs | src/pages/admin/PaymentLogs.tsx | Payment logs | ✅ Working |
| 288 | `/admin/launch-trial` | AdminLaunchTrial | src/pages/admin/LaunchTrial.tsx | Launch trial | ✅ Working |
| 289 | `/admin/store-pricing` | StorePriceEditor | src/pages/admin/components/StorePriceEditor.tsx | Store pricing | ✅ Working |
| 290 | `/admin/errors` | AdminErrors | src/pages/admin/AdminErrors.tsx | System errors | ✅ Working |
| 291 | `/admin/finance` | AdminFinanceDashboard | src/pages/admin/AdminFinanceDashboard.tsx | Finance | ✅ Working |
| 292 | `/admin/manual-orders` | AdminManualOrders | src/pages/admin/AdminManualOrders.tsx | Manual orders | ✅ Working |
| 293 | `/admin/buckets` | BucketsDashboard | src/pages/admin/BucketsDashboard.tsx | Storage buckets | ✅ Working |
| 294 | `/admin/grant-coins` | GrantCoins | src/pages/admin/GrantCoins.tsx | Grant coins | ✅ Working |
| 295 | `/admin/create-schedule` | CreateSchedule | src/pages/admin/CreateSchedule.tsx | Create schedule | ✅ Working |
| 296 | `/admin/officer-shifts` | OfficerShifts | src/pages/admin/OfficerShifts.tsx | Officer shifts | ✅ Working |
| 297 | `/admin/referral-bonuses` | ReferralBonuses | src/pages/admin/ReferralBonuses.tsx | Referral bonuses | ✅ Working |
| 298 | `/admin/control-panel` | ControlPanel | src/pages/admin/ControlPanel.tsx | Control panel | ✅ Working |
| 299 | `/admin/page-visibility` | AdminPageVisibility | src/pages/admin/AdminPageVisibility.tsx | Page visibility | ✅ Working |
| 300 | `/admin/test-diagnostics` | TestDiagnosticsPage | src/pages/admin/TestDiagnosticsPage.tsx | Test diagnostics | ✅ Working |
| 301 | `/admin/trollmers-tournament` | TrollmersTournament | src/pages/admin/TrollmersTournament.tsx | Tournament | ✅ Working |
| 302 | `/admin/jail-management` | AdminJailManagement | src/pages/admin/AdminJailManagement.tsx | Jail management | ✅ Working |
| 303 | `/admin/hr` | AdminHR | src/pages/admin/AdminHR.tsx | HR admin | ✅ Working |
| 304 | `/admin/appeals` | AppealManagement | src/pages/admin/AppealManagement.tsx | Appeals | ✅ Working |
| 305 | `/admin/meetings` | AdminMeetingsDashboard | src/pages/admin/AdminMeetingsDashboard.tsx | Meetings | ✅ Working |
| 306 | `/rtcadminmonitor` | RTCAdminMonitor | src/components/admin/RTCAdminMonitor.tsx | RTC monitor | ✅ Working |
| 307 | `/rfc` | AdminRFC | src/components/AdminRFC.tsx | RFC system | ✅ Working |
| 308 | `/changelog` | Changelog | src/pages/Changelog.tsx | Changelog | ✅ Working |
| 309 | `/admin/shareathon/dashboard` | ShareAThonAdminDashboard | src/pages/shareathon/ShareAThonAdminDashboard.tsx | Share-A-Thon admin | ✅ Working |
| 310 | `/admin/shareathon/verification` | ShareAThonVerification | src/pages/shareathon/ShareAThonVerification.tsx | Share-A-Thon verification | ✅ Working |
| 311 | `/admin/reset-maintenance` | ResetMaintenance | src/pages/admin/ResetMaintenance.tsx | Reset maintenance | ✅ Working |

### ADMIN SYSTEM MANAGEMENT ROUTES (from adminRoutes.tsx)

| # | Route | Page Component | File | Purpose | Status |
|---|---|---|---|---|---|
| 312 | `/admin/system/backup` | DatabaseBackup | src/pages/admin/DatabaseBackup.tsx | DB backup | ✅ Working |
| 313 | `/admin/errors` | AdminErrors | src/pages/admin/AdminErrors.tsx | System errors | ✅ Working |
| 314 | `/admin/system/health` | CityControlCenter | src/pages/admin/CityControlCenter.tsx | System health | ✅ Working |
| 315 | `/admin/officer-operations` | OfficerOperations | src/pages/admin/OfficerOperations.tsx | Officer ops | ✅ Working |
| 316 | `/admin/officer-payroll` | OfficerPayrollReports | src/pages/admin/OfficerPayrollReports.tsx | Officer payroll | ✅ Working |
| 317 | `/admin/coinpurchase-ledger` | CoinPackPurchasesLedger | src/pages/admin/CoinPackPurchasesLedger.tsx | Coin purchases | ✅ Working |
| 318 | `/admin/zip-governance` | ZipGovernanceDashboard | src/pages/admin/ZipGovernanceDashboard.tsx | Zip governance | ✅ Working |
| 319 | `/admin/advertisements` | AdminAdvertisements | src/pages/admin/AdminAdvertisements.tsx | Advertisements | ✅ Working |
| 320 | `/admin/system/cache` | CacheClear | src/pages/admin/CacheClear.tsx | Cache clear | ✅ Working |
| 321 | `/admin/load-lab` | LoadLab | src/components/admin/LoadLab.tsx | Load testing | ❓ Dev only |
| 322 | `/admin/system/config` | SystemConfig | src/pages/admin/SystemConfig.tsx | System config | ✅ Working |
| 323 | `/admin/users/forms` | UserFormsTab | src/pages/admin/components/UserFormsTab.tsx | User forms | ✅ Working |
| 324 | `/admin/calls` | AdminCallsTab | src/pages/admin/components/AdminCallsTab.tsx | Calls | ✅ Working |
| 325 | `/admin/support-tickets` | AdminSupportTicketsPage | src/pages/admin/AdminSupportTicketsPage.tsx | Support tickets | ✅ Working |
| 326 | `/admin/customer-service` | CustomerServiceDashboard | src/pages/admin/CustomerServiceDashboard.tsx | Customer service | ✅ Working |
| 327 | `/admin/seller-management` | SellerManagement | src/pages/admin/SellerManagement.tsx | Seller management | ✅ Working |
| 328 | `/admin/court-dockets` | CourtDocketsManager | src/pages/admin/CourtDocketsManager.tsx | Court dockets | ✅ Working |
| 329 | `/admin/seasonal-goals` | SeasonalGoals | src/pages/admin/SeasonalGoals.tsx | Seasonal goals | ✅ Working |
| 330 | `/admin/payout-batches` | PayoutBatches | src/pages/admin/PayoutBatches.tsx | Payout batches | ✅ Working |
| 331 | `/admin/jail-management` | AdminJailManagement | src/pages/admin/AdminJailManagement.tsx | Jail management | ✅ Working |
| 332 | `/admin/friday-battles` | FridayBattlesDashboard | src/pages/admin/FridayBattlesDashboard.tsx | Friday battles | ✅ Working |
| 333 | `/admin/tournaments` | TournamentManager | src/pages/admin/components/TournamentManager.tsx | Tournaments | ✅ Working |
| 334 | `/admin/reports/weekly` | WeeklyReportsView | src/pages/admin/WeeklyReportsView.tsx | Weekly reports | ✅ Working |
| 335 | `/admin/jail-test` | AdminJailManagement | src/pages/admin/AdminJailManagement.tsx | Jail test | ❓ Dev only |
| 336 | `/admin/startup-expense-tracker` | StartupExpenseTracker | src/pages/admin/StartupExpenseTracker.tsx | Startup expenses | ✅ Working |
| 337 | `/admin/security-command-center` | SecurityCommandCenter | src/pages/admin/SecurityCommandCenter.tsx | Security command | ✅ Working |

### REDIRECT ROUTES

| Route | Redirects To | Status |
|---|---|---|
| `/intro` | `/` | ✅ |
| `/landing` | `/` | ✅ |
| `/terms` | `/legal/terms` | ✅ |
| `/terms-of-service` | `/legal/terms` | ✅ |
| `/privacy-policy` | `/legal/privacy` | ✅ |
| `/payment-terms` | `/legal/refunds` | ✅ |
| `/creator-agreement` | `/legal/creator-earnings` | ✅ |
| `/home` | `/` | ✅ |
| `/mobile` | `/home` | ✅ |
| `/messages` | `/utromail` | ✅ |
| `/tcps` | `/utromail` | ✅ |
| `/city-hall` | `/home` | ✅ |
| `/events/universe` | `/universe-event` | ✅ |
| `/career` | `/careers` | ✅ |
| `/stream/:id/summary` | `/live` | ✅ |
| `/stream-ended` | `/live` | ✅ |
| `/trending-creators` | `/top-creators` | ✅ |
| `/new-creators` | `/top-creators` | ✅ |
| `/add-card` | `/profile/setup` | ✅ |
| `/family/chat` | `/family` | ✅ |
| `/family` | `/family/browse` | ✅ |
| `*` (catch-all) | `/` | ✅ |

---

## 📋 Component Inventory Summary

### By Category

| Category | Count | Key Components |
|---|---|---|
| UI Primitives (src/components/ui) | ~20 | Button, Card, Dialog, Input, Tabs, etc. |
| Broadcast System | ~80+ | BroadcastPage, ViewerPage, SetupPage, Battle*, Chat*, Gift* |
| Admin Components | ~50+ | AdminDashboard, UserManagement, Finance, Reports |
| Family System | ~10 | FamilyHub, FamilyChat, FamilyWars |
| Government | ~12 | Elections, Laws, Protests, Corruption |
| TCNN (News) | ~12 | TCNNMain, ArticleReader, Broadcaster |
| Auction System | ~15 | AuctionStudio, LiveAuctionRoom, Bidders |
| Academy System | ~20+ | Courses, Assignments, Quizzes, Grading |
| Court System | ~10 | CourtRoom, CourtViewer, Dockets |
| Church System | ~5 | ChurchPage, PastorDashboard, PrayerFeed |
| Gaming | ~10 | Trollopoly, TrollWheel, TrollToe, Hytro |
| Profile/User | ~15 | Profile, Settings, Avatar, Levels |
| Payments | ~10 | CoinStore, PayoutRequest, PaymentCallback |
| Organizations | ~5 | OrganizationDashboard, Members, Files |
| Secretary | ~10 | SecretaryConsole, Calendar, PayoutControl |
| Security | ~3 | TurnstileGate, BugAlert |
| Troll System | ~10 | TrollOverlay, TrollEvents, TrollProvider |
| Misc | ~50+ | Sidebar, Header, Modals, Animations |

---

## 🔢 Final Tally

| Metric | Count |
|---|---|
| **Total Unique Route Patterns** | ~230 |
| **Total Page Components** | ~165 |
| **Total UI Components** | ~569 |
| **Total Edge Functions** | ~126 |
| **Total Database Migrations** | ~898 |
| **Total Service Files** | ~12 |
| **Total Stores (Zustand)** | ~10 |
| **Total Type Files** | ~36 |
| **Total Contexts** | ~13 |
| **Total Custom Hooks** | ~146 |
| **Total Test Files** | 1 (Playwright smoke tests exist) |

---

*Note: Route count includes parameterized routes as single patterns. Each parameterized route (e.g. `/agency/:agencyIdOrSlug`) counts as one route pattern but serves multiple URLs.*
