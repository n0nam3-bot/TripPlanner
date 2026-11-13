# Vercel Web Analytics and Speed Insights

Tripfinder includes both Vercel telemetry components:

- **Web Analytics** records page views and referral/page trends.
- **Speed Insights** collects real-user performance metrics. It is sampled at 25% to limit data-point usage while retaining a useful performance signal.

## One-time Vercel activation

1. Open the Tripfinder project in the Vercel dashboard.
2. Open **Analytics** and select **Enable**.
3. Open **Speed Insights** and select **Enable**.
4. Deploy this code update. Vercel adds the collection endpoints during deployment.
5. Visit the production site and check both dashboards after real traffic has been recorded.

No API key or environment variable is required. These features do not consume SerpApi, Geoapify, OpenRouter, Gemini, or WeatherAPI credits.

## Privacy handling in the app

- `/admin` and `/api` paths are excluded from both telemetry streams.
- Query strings and URL fragments are removed before events are sent. This prevents trip dates, destination text, passenger counts, and budget values carried in `/results` query parameters from being sent as URL data.
- The package does not add custom events or record search form contents.
- Vercel documents Web Analytics as aggregated and cookie-less; review Vercel's current privacy documentation and your own privacy notice before production use.

## Usage notes

The Vercel Hobby plan currently lists 50,000 Web Analytics events per month and 10,000 Speed Insights data points, with one Speed Insights project. Speed Insights is configured at a 25% sample rate. Plan entitlements and prices can change; check the project's **Usage** dashboard before moving to a paid plan or enabling paid add-ons.

## Verification

The instrumentation is inactive during local development. After deployment, verify that page views appear in Analytics, that `/admin` is absent, and that URL query strings are not included in page records. Speed Insights may take additional production traffic to show sampled measurements.
