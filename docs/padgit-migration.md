# Moving from Notes to Padgit

Padgit is the new name. The working shared copy is still at
[the existing address](https://forwardmotionnz.github.io/notes/).
The intended permanent address is [padgit.com](https://padgit.com/).
This is a staged move; the domain is not declared live by this change.

## Before the move

Save every edited note, and copy any unsaved drafts somewhere safe on every
device and in each browser or home-screen app you used. Check conflicts too.
The files saved on GitHub stay in place. Browser sign-ins, drafts, recent
paths and other local preferences belong to an address and do not transfer.
Do not sign out while you still need drafts: sign-out removes them.

The app displays a notice at the old address before any redirect is enabled.
Leave time for people to see it. It never redirects automatically, exports
tokens or sends local data to the new address. Everyone signs in again after
the move; old home-screen shortcuts may need replacing.

## Owner cutover

The name search on 2026-09-29 found no obvious software product called
"Padgit" in general web results. That is a preliminary check, not evidence
that the name is available as a trade mark. The owner still needs to confirm
the name before switching the public service.

1. Publish the notice first and confirm users have saved or copied drafts.
   Keep the existing GitHub App, client ID, Worker and secret.
2. In **forwardmotionnz organisation Settings → Pages**, add `padgit.com`
   as a verified domain. Add GitHub's exact TXT record at your DNS provider,
   verify it, and keep that record. This is Pages domain verification,
   separate from the organisation profile badge.
   [GitHub's verification instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).
3. Plan a short maintenance window: DNS, certificate issuance and the
   authentication settings are not atomic. In **notes repository Settings →
   Pages**, set the custom domain to `padgit.com`, then configure apex DNS.
   If Save reports "Unable to commit CNAME because the Pages branch is
   protected", keep branch protection enabled. Add a root file named `CNAME`
   containing only `padgit.com` through a pull request to `main`. After it
   merges and Pages deploys, refresh the repository's Pages settings to check
   the custom domain and certificate status. Organisation domain verification
   alone does not assign the domain to this repository.
   GitHub recommends this order rather than pointing DNS at an unclaimed site.
   Use an ALIAS/ANAME to `forwardmotionnz.github.io`, or these four A records:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   A `www` CNAME may point to `forwardmotionnz.github.io` (no `/notes` path).
   Avoid wildcard records. Wait for DNS and HTTPS readiness; enforce HTTPS.
   GitHub says DNS and HTTPS availability can take up to 24 hours.
   [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
4. In the existing GitHub App settings, use an available name such as
   **Padgit Notes** (`Padgit` is reserved for the existing `@padgit` account),
   homepage to `https://padgit.com/`, and callback to `https://padgit.com/`.
   Check the resulting App installation URL: if its slug changed, update
   `deployment.appSlug` in `index.html` to that actual slug. Keep the client ID.
5. From `broker`, deploy the prepared configuration:

   ```powershell
   npx wrangler deploy --config wrangler.padgit.toml
   ```

   It updates the same Worker, permits only `https://padgit.com`, and uses the
   root callback. The existing `CLIENT_SECRET` stays set. Do not regenerate it.
6. Verify `https://padgit.com/` serves Padgit, its manifest and icons; sign in,
   open an existing note, save a harmless edit, then reload it. Verify the old
   address redirects correctly and the homepage shortcut works. Only then
   announce the new address and replace the README's working Try it link.
7. Copy the verified cutover values into the default `broker/wrangler.toml`
   so the next ordinary deploy cannot restore the old origin. Keep the
   `migrationFrom` notice configuration for old copies. Pull any `CNAME` commit
   made by Pages settings. The preparation change omitted CNAME; adding it
   during cutover connects this repository to the new address.

## If the cutover fails

Keep the TXT verification. Restore the previous Pages custom-domain setting,
GitHub App homepage/callback and any changed installation slug, and deploy the
original `broker/wrangler.toml` while it still contains the old values. Once
step 7 is done, restore those values from git history first. Confirm sign-in
at the old address. DNS caches may take time to settle. Save/copy any drafts
created on the new address before redirecting people back; those drafts do
not transfer either. Do not rename the repository as part of this cutover.
