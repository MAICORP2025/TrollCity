# 💾 Backup & Disaster Recovery Plan

**Objective:** Ensure ZERO data loss for financial/user data and <4 hour recovery time (RTO) for total system failure.

---

## 1. Backup Strategy

### A. Database (Supabase)
*   **Point-in-Time Recovery (PITR)**: Enabled (7 days retention). Allows restoring to *any second*.
*   **Daily Backups**: Automated daily full backups (30 days retention).
*   **Manual Snapshots**: Take a snapshot before *every* major migration.

### B. Codebase
*   **GitHub**: Main branch is the source of truth.
*   **Tags**: Every deployment is tagged (e.g., `v1.0.2-20260107`).

### C. Assets (Images/Videos)
*   **Storage**: Supabase Storage / S3.
*   **Redundancy**: Replicated across regions (handled by provider).

---

## 2. Recovery Procedures

### Scenario A: Accidental Data Deletion (e.g., deleted `users` table)
**Tool**: Supabase Dashboard -> Database -> Backups -> Point-in-Time Recovery.
1.  **Select Time**: Choose a timestamp *5 minutes before* the accident.
2.  **Restore**: Clone to a *new* project first to verify, or restore in-place (DANGEROUS - stops service).
3.  **Verification**: Check key tables (`user_profiles`, `troll_coins`).

### Scenario B: Bad Migration (Schema Corrupted)
**Tool**: Revert Migration.
1.  **Identify**: Which migration failed?
2.  **Revert**: Create a `revert_...sql` file that undoes the changes (e.g., `DROP TABLE`).
3.  **Apply**: Run the revert SQL.

### Scenario C: Total Region Failure (Supabase Down)
**Tool**: Cross-Region Failover (Enterprise feature) or Restore to new provider.
1.  **Export**: If possible, `pg_dump` from the read replica.
2.  **Import**: Restore to a generic Postgres instance.
3.  **Config**: Update environment variables `VITE_SUPABASE_URL` to point to the new DB.

---

## 3. Scheduled Drills

*   **Quarterly**: Test restoring a backup to a staging environment.
*   **Monthly**: Verify "Emergency Lockdown" commands work.

---

## 4. Critical Data (Do Not Lose)

| Table | Importance | Backup Frequency |
| :--- | :--- | :--- |
| `user_profiles` | Critical | Real-time (PITR) |
| `payout_requests` | Critical (Financial) | Real-time (PITR) |
| `coin_transactions` | Critical (Audit) | Real-time (PITR) |
| `action_logs` | High (Security) | Daily |

---

## 📜 Manual Backup Command (CLI)
```bash
# Dump entire database schema + data
supabase db dump --db-url "$DB_URL" -f "backup_$(date +%Y%m%d).sql"

# Restore
psql "$NEW_DB_URL" < backup_20260107.sql
```
