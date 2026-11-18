# ECES Bayanihan: full backup and restore

The **Download record** button on the admin page saves only the main school record (JSON). It does **not** include the attachments (concern photos, receipts, minutes, project photos), the sign-in records, or a way to restore. It is a quick snapshot, not a backup.

A **full backup** is a copy of the whole database, made with PostgreSQL's free `pg_dump` tool. Attachments are stored inside the database, so one file holds everything. The Supabase free plan does not make automatic backups for you.

This was tested on 18 Nov 2026 with synthetic data only: a record, a sign-in, a concern photo, a receipt and minutes. Every count and fingerprint matched after restoring into a separate database, row-level security came back on, a damaged attachment was caught, and a cut-off backup file failed with an error.

## Who and when (PENDING SCHOOL APPROVAL)
- **Custodian:** one named person, agreed with the School Head, plus one named backup person. Write their names in the school's operating memorandum, not in this repository.
- **When:** every week, the day before the General Assembly, and before any big change.
- **Where to keep it:** an encrypted file on a device the custodian controls (not a shared drive, chat, email or public cloud folder). Keep the last 4 weekly backups; delete older ones securely.
- **When a custodian leaves:** hand over in person, change the database password and the admin key, and delete their copies.

## 1. Make a backup (about 5 minutes)
You need PostgreSQL's command-line tools (free, from postgresql.org; on Windows tick only "Command Line Tools"). Use version 17 or newer so it can read Supabase's database.

1. In Supabase, open **Connect** (top bar), choose **Session pooler**, and copy the connection string. It contains the database password, so never paste it anywhere else.
2. In a terminal:
   ```
   pg_dump "<connection string>" --schema=public --format=custom --no-owner --no-privileges --file=eces-YYYY-MM-DD.dump
   ```
3. Encrypt it right away and delete the unencrypted file. On Windows, 7-Zip (free): right-click → 7-Zip → Add to archive → Encryption: AES-256, a long passphrase, tick **Encrypt file names**. Keep the passphrase in a password manager, separate from the file.

## 2. Check the backup is complete
In Supabase → SQL Editor, run `supabase/backup-check.sql` and save the result with the backup. It shows counts and fingerprints only, never names or file contents.

## 3. Test a restore (once a term, never on the live project)
1. Restore into a separate, empty database: a local PostgreSQL on the custodian's computer, or a second free Supabase project made only for this test and deleted afterwards.
   ```
   createdb eces_restore_test
   pg_restore --dbname=eces_restore_test --no-owner --no-privileges eces-YYYY-MM-DD.dump
   ```
2. Run `supabase/backup-check.sql` on the restored copy. Every line must match the result saved in step 2. If a line differs, or `pg_restore` shows an error, the backup is not good: make a new one.
3. Delete the test database.

## 4. A real restore (only with the School Head's go-ahead)
Never restore over the live project automatically. Agree it with the School Head first, make a fresh backup of the current state, then restore into a fresh Supabase project and point the app at it.

**What comes back:** the school record, attachments, sign-ins, sessions and the last 300 saved versions. Sessions are kept because they expire by themselves (8 hours for officers, 30 days for parents). If the backup might have been seen by someone else, end every session after restoring: run `delete from sessions;` so everyone signs in again. Rate-limit counters are temporary, so it does not matter whether they come back.

## If a backup is lost or exposed
Treat it as a possible data breach. Tell the School Head and the Data Protection Officer at once. The National Privacy Commission expects notice within 72 hours. Then change the database password and the admin key, and end all sessions.
