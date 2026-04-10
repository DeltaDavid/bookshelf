# Bookshelf — Project Rules

## What This Is
Personal book collection browser. Single-file vanilla JS PWA deployed to Cloudflare Pages.

## Architecture
- **Single file:** `index.html` contains all HTML, CSS, and JS
- **Data:** `data.json` (static book data, committed to repo)
- **Hosting:** Cloudflare Pages (`david-bookshelf`), deploy via `npx wrangler pages deploy . --project-name=david-bookshelf`
- **PWA:** `manifest.json`, `sw.js`, app icons

## Coding Standards
- Follow Airy Pastel design system (soft blues, pastels, generous spacing, rounded corners)
- All CSS uses custom properties defined in `:root`
- Mobile-first responsive design (iPhone, iPad, Mac)
- No external JS frameworks or build tools
- No npm, no bundler — this is a single HTML file with embedded `<script>` and `<style>`

## Quality Gates (mandatory before reporting complete)
1. **Lint the JS:** Extract `<script>` content and verify no syntax errors, no `var` usage, no console.log left in production
2. **Test in browser:** Open index.html locally or deploy to preview — verify the feature works visually
3. **Check mobile:** Verify layout doesn't break at 375px width
4. **Validate HTML:** No duplicate IDs, no unclosed tags, no inline styles outside the `<style>` block
5. **Performance:** data.json loads and renders without visible delay

## Common Mistakes to Avoid
- Don't split into multiple files — this is intentionally a single-file app
- Don't add npm/package.json — there is no build step
- Don't use `var` — use `const` and `let`
- Don't leave `console.log` in production code
- Don't break the service worker cache versioning — increment SW version on every change
- Don't change the Airy Pastel color variables without checking all apps for consistency

## Deploy Workflow
1. Make all changes locally
2. Test by opening index.html in browser
3. Report changes to David with numbered summary
4. Wait for David's approval
5. Deploy: `npx wrangler pages deploy . --project-name=david-bookshelf`
