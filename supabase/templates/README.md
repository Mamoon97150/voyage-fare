# Email templates (sign-in polish, 15 Nov 2026)

Supabase keeps these in the dashboard: **Authentication → Emails → Templates**. Paste each file in
the matching template, with its subject:

| Template | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirm your email |
| Reset password | `reset-password.html` | Choose a new password |
| Change email address | `change-email.html` | Confirm your new email |

They use Supabase's variables: `{{ .ConfirmationURL }}`, `{{ .Data.first_name }}` (the first name
given at sign-up), `{{ .NewEmail }}`.

**Before testers sign up:** Supabase's built-in sender only delivers to the project team's addresses,
a few per hour. Set up our own sender (decision pending, Resend proposed) in **Authentication →
Emails → SMTP settings** when the app has its address (build 7, step 6).
