# invite-company-user

Invites an Auth user into the authenticated management user's company. The request accepts only `email`, `display_name`, and `role`; it never accepts `company_id` or a password.

Required secret/config: `APP_ORIGIN` as an HTTP(S) origin without query or fragment (and the Supabase-provided URL, anon key, and service-role key). Every invitation is redirected to the fixed application route `/auth/establecer-clave?intent=invite`; the request cannot choose a redirect. The exact callback URL must be present in the Supabase Auth redirect allow list. Production email delivery requires SMTP configuration in Supabase Auth.

Deploy from `implementation/`:

```sh
pnpm exec supabase functions deploy invite-company-user --project-ref <project-ref>
```

The function verifies the caller session again, requires an active management profile, creates the Auth invitation, then creates the profile. If profile creation fails, it deletes the invited identity or disables it if deletion also fails.
