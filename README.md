# Tripfinder — travel planning platform starter

A polished, responsive Next.js starter for a travel discovery and planning product. This first release focuses on the customer experience and the foundations needed for provider integrations later.

## Mobile ZIP updates with GitHub Actions

The repository includes `.github/workflows/import-project-zip.yml`. After the one-time workflow setup, upload future project ZIP files directly into the **repository root** from your phone and commit them. GitHub Actions safely unpacks the archive into the repository's normal folder structure, overwrites matching files, adds new files, removes the ZIP from the current working tree, and commits the extracted update. If the repository is connected to Vercel, that extracted commit should trigger a deployment.

**One-time bootstrap:** the workflow must be installed before it can process the first ZIP. On mobile GitHub, use **Add file → Create new file**, name it `.github/workflows/import-project-zip.yml`, paste the contents of the supplied workflow file, and commit. Then upload the starter ZIP at the repository root. See [`docs/MOBILE-ZIP-UPDATES.md`](docs/MOBILE-ZIP-UPDATES.md).

The importer is overlay-only: matching files are replaced and new files are added, but files absent from a ZIP are not deleted. It protects the workflow itself and real environment secrets. The uploaded ZIP remains in Git history even after the action removes it from the current file tree.

## Technology and services

| Component | Role | Needed now? |
|---|---|---|
| GitHub | Source repository and version history | Yes |
| GitHub Actions | Automatically unpacks ZIP updates and commits extracted files | Yes, for mobile ZIP workflow |
| Vercel | Hosts the Next.js website and deploys repository commits | Yes, for a public preview website |
| Next.js + React + TypeScript | Application framework and user interface | Yes |
| npm packages | UI animation and icon dependencies (Framer Motion, Lucide React) | Installed during build |
| Neon PostgreSQL | Search history, saved trips and user data persistence | Not connected yet |
| Amadeus / other travel APIs | Live flight, hotel and activity information | Not connected yet |
| AI provider | Optional natural-language preference interpretation | Not connected yet |

No Neon database, API credentials or environment variables are required for the current preview release. The current results are illustrative demo content, not live fares or inventory.

**Cost note:** GitHub Actions standard runners are free for public repositories; private repositories use the included plan quota and may incur charges if usage exceeds it. Vercel Hobby is for personal, non-commercial use. Before the site is used to generate affiliate or other business revenue, review Vercel's current terms and move to an eligible commercial plan or hosting provider. See the official [GitHub Actions billing documentation](https://docs.github.com/en/actions/concepts/billing-and-usage) and [Vercel Hobby plan](https://vercel.com/docs/plans/hobby).

## What is included

- Editorial-style responsive homepage with travel photography and restrained motion.
- Interactive trip brief form (origin, destination, dates, travelers, budget, trip mood and date flexibility).
- Results page with three clearly labeled illustrative trip concepts.
- Expandable trip cost breakdowns.
- Visible demo-data disclosure: no live flight fares, hotel inventory or bookable packages are represented.
- Provider adapter interface and safe mock provider placeholder.
- Health endpoint at `/api/health`.
- Reduced-motion support for visitors who request it.

## What is intentionally not included yet

- Live flights or hotel inventory.
- Affiliate tracking or affiliate accounts.
- Reservations, payments or customer accounts.
- Claims of exact package availability or real-time pricing.

Do not remove the demo-data disclosures until real provider data and validation are implemented.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

No environment variables are required for the preview release.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, import that repository.
3. Keep the framework preset as Next.js.
4. No environment variables are required for the first preview release.
5. Deploy.

The `/api/health` endpoint should return `status: "ok"`, `mode: "preview"`, and `liveTravelProvidersConnected: false`.

## Design direction

Tripfinder uses a warm editorial travel aesthetic: off-white surfaces, deep forest-green accents, restrained clay details, serif display typography, large destination photography, thin rules, and subtle motion. Avoid generic AI gradients, oversized pill UI, noisy cards, fake review counts, fake live prices, and decorative animation that slows down the planning flow.

## Next implementation milestones

1. Add validated destination and airport reference data.
2. Formalize search requirements (including child ages, rooms, airport radius, baggage, stops, accessibility and hard-vs-soft preferences).
3. Add deterministic fixture datasets and automated tests for search validation, date/time zones, room occupancy, budget calculations and ranking.
4. Implement an Amadeus test-environment adapter behind `TravelProvider`.
5. Add persistence in Neon only after the search model and schema are stable.
6. Add live-provider adapters and price/availability revalidation only when approved credentials and terms are available.
7. Implement provider-specific deep links with tests that verify every encoded search parameter.

## Environment variables (future)

See `.env.example`. Do not commit API credentials. Keep all provider credentials server-side; never expose secrets in `NEXT_PUBLIC_*` variables.
