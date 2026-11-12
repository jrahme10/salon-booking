# Calendar provider setup

The calendar connection endpoints are deployed with the Worker. Provider credentials are deliberately stored as Cloudflare Worker secrets, never in the frontend or repository.

## Required Cloudflare Worker secrets

In Cloudflare, open **Workers & Pages → salon-booking → Settings → Variables and Secrets** and add:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `CALENDAR_ENCRYPTION_KEY`

Generate a fresh 32-byte encryption key in PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Paste the generated Base64 value directly into the `CALENDAR_ENCRYPTION_KEY` secret. Do not commit it or send it in chat. Keep a secure backup: losing this key makes previously encrypted calendar credentials unreadable.

## Google Calendar OAuth

1. In Google Cloud Console, create or select a project and enable the **Google Calendar API**.
2. Configure the OAuth consent screen. Add the Google accounts that will test the integration as test users while the app is in testing.
3. Create an OAuth client with application type **Web application**.
4. Add this exact Authorized redirect URI:

   `https://salon-booking.jrahme10.workers.dev/calendar/google/callback`

5. Save the OAuth Client ID and Client Secret as the two Cloudflare secrets above.
6. Redeploy the Worker after adding the secrets.

The app requests calendar access so it can later read busy periods and create/update only events it owns.

## Apple Calendar (iCloud)

Each person connecting Apple Calendar must create an app-specific password at [account.apple.com](https://account.apple.com/) under **Sign-In and Security → App-Specific Passwords**. In Salon Reservation, enter their Apple Account email and that app-specific password. Do not use the person's normal Apple Account password.

## Current implementation boundary

This release implements secure account-linking flows, per-user connection records, encrypted credential storage, OAuth state validation, and queued initial-sync jobs. It does **not yet synchronize calendar events or block appointment slots**. Those require the next background sync implementation and provider-level verification. A connected status means the provider account was linked successfully, not that events are already synchronized.
