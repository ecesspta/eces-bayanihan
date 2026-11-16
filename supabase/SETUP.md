# Putting ECES Bayanihan on Supabase (free plan)

Do these in order. Each step takes a few minutes. Nothing here costs money on the free plan.

## 1. Make the database tables
1. In your Supabase project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql`, copy everything, paste it, press **Run**. It should say "Success".

## 2. Put the server function online
1. Open **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `eces`.
3. Delete the sample code. Open `supabase/functions/eces/index.ts`, copy everything, paste it. Press **Deploy**.
4. Your server address is `https://<your-project-ref>.supabase.co/functions/v1/eces`. Send it to Sarah's assistant. It is not secret.

## 3. Set the admin key
1. Make a long random key (40 or more letters and numbers). A password manager can make one.
2. **Edge Functions** → **Secrets** → add `ADMIN_KEY` with that key. Keep a copy somewhere private. It is never put in the app or on GitHub.

## 4. Build the app and set up the rehearsal data
1. Send the server address and the public "anon" key (Settings → API) to the assistant, who builds the `live/` folder and pushes it.
2. Open `https://sarahbarlis09.github.io/eces-bayanihan/live/admin.html`, type the admin key, press **Set up rehearsal data**. The fictional sample sign-ins download once. Keep them private.
3. Open `https://sarahbarlis09.github.io/eces-bayanihan/live/` and sign in as the chairperson.

## 5. Backups (do this every week, and the day before the General Assembly)
Open `live/admin.html`, type the admin key, press **Download backup**. Keep the file private. The database also keeps its last 300 saved versions.

## Before real families' details go in
- The school's Data Protection Officer confirms the Privacy Notice wording (set `PRIVACY_DRAFT` to false after that).
- Real officer accounts replace the fictional sample accounts.
- Check the Supabase free plan limits and pause rules that day. Free projects pause after about a week without use, so open the app at least weekly, or upgrade for the General Assembly week.

## Switching from the fictional rehearsal to the real school record
1. Open `live/admin.html`, type the admin key, and in **Start the real record** write one officer per line as `role: Full Name` (roles: head, chair, vice, secretary, treasurer, collector). Press **Start real record**. This deletes the fictional data and cannot be undone. It is refused once real data exists.
2. The page downloads a file of one-time invite codes. Give each officer only their own code, privately.
3. Each officer opens the app, taps **More → Sign in → I am an officer with an invite code**, enters their code, their own mobile number and a password, and ticks the Privacy Notice box.
4. Lost phone or forgotten sign-in: **New code for one officer** on the admin page. The collecting officer can be added the same way later.
Do not type real names into the repository or into chat history you share. They belong only in the database.
