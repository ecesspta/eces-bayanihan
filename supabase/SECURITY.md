# ECES Bayanihan security notes

## What protects the data
- **Nothing public can read the database.** Every table has row level security on and no access for the public key. Only the server function, which connects directly, reads or writes.
- **Rules are enforced on the server.** The app cannot skip an approval, see another role's records, or read a private concern. Each reply is filtered by the signed-in role.
- **Passwords** are stored only as salted scrypt hashes. Sign-in tokens are 256-bit random values stored only as hashes, and expire (8 hours for officers, 30 days for parents on a known phone).
- **Slowing down guessing:** per connection, and also per account (10 wrong tries, then a 15 minute wait), and a limit on new accounts per connection.
- **Officer invite codes** are one-time, expire after 14 days, and only a hash is stored.
- **Files** are checked by their real contents (PDF, PNG, JPEG, WEBP only, 8 MB), never served as web pages, and private files need the right role.
- **Browser protections:** a strict content policy (only this site's scripts run, and the app talks only to its own server), every screen value is escaped, no outside scripts or trackers.
- **Admin actions** (starting the real record, new officer codes, backups) are written to the change history that the School Head, chairperson and vice-chairperson can read.
- **Last 300 saved versions** of the school record are kept in the database.

## What only people can do
1. Turn on **two-step sign-in** for the Supabase account, the GitHub account and the email address that owns both. This is the biggest real-world risk.
2. Keep the **admin key** and the **database password** in a password manager. Never in chat, email or the repository. Change the admin key if anyone who knew it leaves.
3. Share the Supabase project only with people who need it, using their own accounts.
4. Download a **backup** every week and the day before the General Assembly. Keep it on a private, protected device. The free plan does not promise automatic backups.
5. Have the school's **Data Protection Officer** confirm the Privacy Notice and the plan for a data breach (the National Privacy Commission expects notice within 72 hours of a breach).
6. Open the app at least once a week so the free project does not pause.

## Known limits
- Data sits in a Sydney data centre. Say so to the Data Protection Officer.
- Names and phone numbers are protected by access rules and the provider's disk encryption, not by a separate encryption layer inside the database.
- A parent who knows another parent's mobile number can learn that an account exists (the sign-up form says so). They cannot sign in without the password.
- The password reset for parents relies on the phone having signed in before plus the last name and grade and section. Officers reset through a new invite code from the chairperson.
- A security expert's review has not been done. Before the school relies on the app long term, ask the division ICT office or a trusted IT volunteer to review it.
