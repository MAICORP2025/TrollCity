# Unrouted / Potentially Unused Files Report

The following files were found in `src/pages` but do not appear to be directly referenced in `src/App.tsx` or `src/pages/admin/adminRoutes.tsx`.

## Likely Legacy / Unused Pages
These files seem to be duplicates or older versions of existing pages.

*   `src/pages/AccountPaymentLinkedSuccess.tsx`
*   `src/pages/AccountPaymentsSuccess.tsx`
*   `src/pages/AIVerificationPage.tsx`
*   `src/pages/AvatarCustomizer.tsx`
*   `src/pages/Cashouts.tsx` (See `CashoutPage.tsx`)
*   `src/pages/CoinStoreProd.tsx` (See `CoinStore.jsx`)
*   `src/pages/CourtRoomLegacy.jsx` (See `CourtRoom.tsx`)
*   `src/pages/CreatorApplication.tsx`
*   `src/pages/CreatorApplicationStatus.tsx`
*   `src/pages/CreatorDashboard.tsx`
*   `src/pages/DistrictTour.tsx`
*   `src/pages/EarningsPayout.tsx` (See `EarningsPage.jsx`, `MyEarnings.tsx`)
*   `src/pages/EntranceEffects.tsx`
*   `src/pages/GiftCardsPage.tsx` (See `GiftCardsManager.tsx` in admin)
*   `src/pages/GiftInventoryPage.jsx`
*   `src/pages/GiftStorePage.jsx` (See `CoinStore.jsx`)
*   `src/pages/GoLiveSetup.tsx` (See `GoLive.tsx`)
*   `src/pages/Home.old.tsx`
*   `src/pages/MaiLab.tsx`
*   `src/pages/PaymentSettings.tsx`
*   `src/pages/ProfileSetupPage.tsx` (See `ProfileSetup.tsx`)
*   `src/pages/ShopDashboard.tsx`
*   `src/pages/TrollerInsurance.tsx`
*   `src/pages/TrollIdentityLab.tsx`
*   `src/pages/TrollMart.tsx`
*   `src/pages/TrollmondsStore.tsx`
*   `src/pages/TrollOfficerApplication.tsx` (See `OfficerApplication.tsx`)
*   `src/pages/TrollsTown3DPage.tsx` (See `TrollsTownPage.tsx`)
*   `src/pages/TromodyShow.jsx` (See `TromodyShow.tsx`)
*   `src/pages/WatchPage.tsx`
*   `src/pages/WeeklyFamilyChallenge.tsx`

## Components / Hooks (Misplaced in Pages Directory?)
These files appear to be components or hooks rather than full pages, but are located in `src/pages`.

*   `src/pages/GiftEventOverlay.tsx`
*   `src/pages/GiftSoundPlayer.tsx`
*   `src/pages/ReelActions.tsx`
*   `src/pages/ReelComments.tsx`
*   `src/pages/ReelSlide.tsx`
*   `src/pages/useGiftSystem.ts`
*   `src/pages/useStreamEarnings.ts`

## Action Items
1.  **Review**: Please review the files in the "Likely Legacy" section.
2.  **Delete**: If confirmed unused, delete them to reduce codebase noise.
3.  **Move**: Consider moving components and hooks to `src/components` or `src/hooks`.
