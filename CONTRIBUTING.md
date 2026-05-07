# Contributing

## Secret-handling rules (must read)

This repository hosts the public ConoHa CLI documentation and example
recipes. Every code block in these docs is something a reader is likely
to copy-paste into a terminal. To prevent the kind of incident where
near-production data leaks into samples, contributors **must** follow
these rules:

1. **No hardcoded passwords or tokens in example code blocks.** Use
   `${VAR_NAME:?required}` (compose) or `<PLACEHOLDER>` (shell). Never
   write `POSTGRES_PASSWORD=postgres` or similar — readers will copy
   that and run it. Weak defaults (`:-admin`, `:-minioadmin`,
   `:-rootpassword`) are also banned because users will not override
   them.

2. **No real IPs, VM IDs, hostnames, or tenant IDs in committed
   examples.** Use `<SERVER_IP>` placeholders or the RFC 5737 reserved
   ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`).

3. **Mask connection strings.** `postgres://user:pass@db/mydb` becomes
   `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db/${POSTGRES_DB}`.
   The literal `:pass@` form has been seen in real incident postmortems —
   readers paste it without thinking.

4. **UUIDs and tenant IDs should be obviously fake.** Use
   `00000000-0000-0000-0000-000000000000` or
   `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` rather than realistic-looking
   hex strings, so no reader mistakes them for real values they should
   keep.

5. **Pre-publish drafts and handoff memos belong outside git.**
   `docs/memory/` is gitignored.

## How we enforce this

* **`gitleaks` runs on every PR** via GitHub Actions
  (`.github/workflows/gitleaks.yml`). PRs with detected secrets are
  blocked from merge.
* **`.gitignore`** blocks `.env`, `.env.*`, `*.pem`, `*.key`,
  `id_rsa*`, `*credentials*`, and `docs/memory/`.
* **Reviewers should grep PRs** for `_PASSWORD=`, `_SECRET=`,
  `_TOKEN=`, literal IPs, and known token prefixes (`sk_`, `pk_`,
  `whsec_`, `hf_`, `Bearer `).

## If you accidentally commit a secret

1. **Rotate it immediately at the source service.** Assume the value
   is already public.
2. After rotating, remove the value from `HEAD` in a follow-up commit.
3. To purge it from git history, use `git filter-repo` and force-push,
   then notify other contributors so they re-clone. Do this only after
   rotation.
