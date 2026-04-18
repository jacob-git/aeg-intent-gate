# Cloudflare Pages

The public demo site lives in `site/` and is plain static HTML, CSS, and JavaScript.

## Recommended Setup: Cloudflare Git Integration

1. Open Cloudflare Dashboard.
2. Go to **Workers & Pages**.
3. Select **Create application**.
4. Choose **Pages**.
5. Choose **Connect to Git**.
6. Select the GitHub repository:

   ```text
   jacob-git/aeg-intent-gate
   ```

7. Use these build settings:

   ```text
   Project name: aeg-intent-gate
   Production branch: main
   Build command: 
   Build output directory: site
   Root directory: /
   ```

8. Deploy.

The default URL should be:

```text
https://aeg-intent-gate.pages.dev
```

Cloudflare will redeploy the site whenever `main` changes.

## CLI Deploy

If `wrangler` is authenticated, deploy directly:

```sh
npm run site:deploy
```

That runs:

```sh
npx wrangler pages deploy site --project-name aeg-intent-gate
```

In non-interactive environments, set `CLOUDFLARE_API_TOKEN` first. The token needs permission to edit Cloudflare Pages for the target account.

## Local Preview

Use Wrangler preview:

```sh
npm run site:serve
```

Or serve `site/` with any static file server.
