# Email templates

Supabase renders these; they are kept here so they are reviewable and survive a
dashboard field being edited by accident. Each file is **exactly** what goes in
the dashboard — paste the whole thing.

## The reader's sign-in code

`reader-otp-email.html` goes into **two** places:

- Authentication → Email Templates → **Magic Link** — a reader signing in again
- Authentication → Email Templates → **Confirm signup** — a reader's first time

Subject for both: `Your sign-in code`

**Changing only Magic Link is the trap.** `signInWithOtp` picks the template by
whether the address is already known, and early on every reader is new — so they
would get the signup template, and if that one still carries
`{{ .ConfirmationURL }}` they receive a link while the app is asking for six
digits.

Supabase decides what to send purely by what the template contains:
`{{ .ConfirmationURL }}` sends a magic link, `{{ .Token }}` sends a code. Do not
leave both in. One email should ask for one thing, and a link that signs you in
sideways is worth more to anyone who intercepts the message than a code that
expires.

### What it depends on

The mark is served from the reader app at a fixed path —
`reader_web/public/brand/mark.png`. **It must be deployed before the email will
render it.** Until then that URL returns `index.html` with a 200 and an HTML
content type, because the SPA rewrite answers anything the filesystem does not,
so the image comes through broken while nothing looks wrong from the outside.

### Why it is built the way it is

Tables and inline styles, because clients strip stylesheets. Georgia stands in
for Marcellus, which is not web-safe. The wordmark is text rather than part of
the image, so the email still reads as itself for the many people whose client
blocks images until asked. The hidden preheader sets the inbox preview line. The
`text-indent` on the code offsets its trailing letter-space so six digits sit
optically centred rather than pushed left.
