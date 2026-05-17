# 🚨 Incident Response Plan (IRP)

**Status:** ACTIVE
**Last Updated:** 2026-01-07
**Severity Levels:**
- **SEV-1 (Critical)**: Site down, Data breach, Payout exploit.
- **SEV-2 (High)**: Major feature broken (e.g., streaming), Payment failures.
- **SEV-3 (Medium)**: Minor bug, UI glitch, non-critical errors.

---

## 🛑 Phase 1: Detection & Triage

**Monitoring Channels:**
1.  **User Reports**: `#bug-reports` in Discord / Support Tickets.
2.  **Sentry/Logs**: Automatic error alerts.
3.  **Supabase Dashboard**: Database load spikes or 500 errors.

**Immediate Action:**
1.  **Acknowledge**: Post in `#status-updates` (Discord/Twitter). "We are investigating an issue with [Feature]."
2.  **Assess Severity**:
    *   Is money at risk? -> **SEV-1**
    *   Is user data exposed? -> **SEV-1**
    *   Is the site unusable? -> **SEV-1**

---

## 🛡️ Phase 2: Containment (Stop the Bleeding)

### Scenario A: Payout/Economy Exploit
*   **Action**: LOCK PAYOUTS IMMEDIATELY.
*   **Command**: Admin Dashboard -> Launch Trial -> **"Relock Payouts"**.
*   **Database**: `UPDATE system_settings SET payout_lock_enabled = true;`

### Scenario B: Content Attack (Raid/CSAM)
*   **Action**: LOCKDOWN MODE.
*   **Command**: Admin Dashboard -> Safety -> **"Enable Global Slow Mode"** or **"Registration Lock"**.
*   **Database**: `UPDATE system_settings SET registration_enabled = false;`

### Scenario C: Bad Deployment
*   **Action**: ROLLBACK.
*   **Vercel/Netlify**: Click "Redeploy" on the last stable commit.

---

## 🔧 Phase 3: Eradication & Recovery

1.  **Identify Root Cause**: Check `action_logs` and server logs.
2.  **Fix**: Deploy hotfix.
3.  **Verify**: Test in Staging (if available) or verify with a test account.
4.  **Restore**:
    *   Unlock payouts/registration once safe.
    *   Refund affected users if necessary.

---

## 📢 Phase 4: Communication

**Template for SEV-1 Resolution:**
> "The issue regarding [Issue] has been resolved. [Brief explanation of what happened]. No user data was compromised. Thank you for your patience."

**Post-Mortem (Internal):**
*   What went wrong?
*   Why didn't we catch it earlier?
*   How do we prevent it next time?

---

## 📞 Emergency Contacts

*   **Lead Developer**: [Name/Contact]
*   **Database Admin**: [Name/Contact]
*   **Legal/Compliance**: [Name/Contact]
