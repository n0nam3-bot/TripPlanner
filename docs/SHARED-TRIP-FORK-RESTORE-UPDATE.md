# Shared-trip fork: preserve and restore selections

## Behavior

- `Make my own copy` now preserves the selected itinerary snapshot instead of creating an empty destination list.
- The copied snapshot retains its selected flights, stay, activities, restaurants, dates, schedule times, and display metadata.
- Safe selection references identify live results without copying supplier booking tokens, POST payloads, or credentials.
- When the copied trip opens in `/results`, Tripfinder matches the saved selections to current provider results and restores only unique exact matches.
- Return flights are looked up again using the newly returned outbound selection. A previously selected seller is checked again and can be restored using the current offer; any changed price is identified as refreshed.
- If a provider no longer returns a unique match, Tripfinder flags that item for review instead of silently choosing a different result.
- Existing saved trips created before this change are supported where their saved snapshot contains sufficient identifying details. Legacy flights are reconstructed from their saved segment text; legacy hotels and experiences are matched by unique names.
- Multi-destination trips restore each destination after the traveler loads that destination's current results. The fork does not trigger searches for every recommendation automatically.

## Privacy and API behavior

- No booking tokens, property tokens, exact booking POST data, owner credentials, or share credentials are copied into the public snapshot.
- The original shared trip remains read-only and unchanged.
- Seller and return-leg refresh requests occur only when those items were selected in the copied itinerary. Activity and accommodation matching uses the already-loaded result set.
- The copy flow uses the existing saved-trip daily limit and does not add database tables or environment variables.

## Shared-page layout

- `Make my own copy` and `Reopen search` occupy separate responsive grid cells.
- On narrow screens, the actions stack at full width and the explanatory note appears below them.

## Validation

- `npm run test:regression`: 127/127 passed.
- TypeScript syntax transpilation: results workspace, copy button, shared-trip page, and saved-trip helper passed.
- Full Next.js production build was not run because `node_modules` is not installed in the reconstructed workspace.
