const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeTripFeedbackSubmission, isTripFeedbackStatus, normalizeTripFeedbackApplyPatch, applyTripFeedbackPatchToSnapshot } = require("../../.test-build/lib/trip-planner/trip-feedback.js");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("feedback submission accepts only bounded, allowlisted suggestions", () => {
  const valid = normalizeTripFeedbackSubmission({
    name: "  Alex\n Smith ", category: "activities", itemTitle: " Waterfall tour ",
    message: "Please move this activity to the second day.", unexpected: "ignored",
  });
  assert.deepEqual(valid, {
    name: "Alex Smith", category: "activities", itemTitle: "Waterfall tour",
    message: "Please move this activity to the second day.",
  });
  assert.equal(normalizeTripFeedbackSubmission({ category: "admin", message: "This is long enough" }), null);
  assert.equal(normalizeTripFeedbackSubmission({ category: "other", message: "short" }), null);
  assert.equal(normalizeTripFeedbackSubmission({ category: "other", message: "x".repeat(3000) }).message.length, 2000);
});

test("feedback review accepts only owner-controlled terminal states", () => {
  assert.equal(isTripFeedbackStatus("reviewed"), true);
  assert.equal(isTripFeedbackStatus("dismissed"), true);
  assert.equal(isTripFeedbackStatus("pending"), false);
  assert.equal(isTripFeedbackStatus("approved"), false);
});

test("feedback invitations are separate hashed capabilities with expiry and bounded submissions", () => {
  const db = read("lib/db/saved-trips.ts");
  assert.match(db, /tripfinder_trip_feedback_invites/);
  assert.match(db, /tripfinder_trip_feedback/);
  assert.match(db, /tokenHash\(inviteToken, "feedback"\)/);
  assert.match(db, /interval '14 days'/);
  assert.match(db, /submission_count < 20/);
  assert.match(db, /owner_token_hash = \$\{tokenHash\(ownerToken, "owner"\)\}/);
  assert.match(db, /s\.updated_at = \$\{expectedUpdatedAt\}::timestamptz/);
  assert.match(db, /stale: new Date\(String\(row\.base_updated_at\)\)\.getTime\(\)/);
});

test("feedback invitation page grants suggestion access only and remains non-indexed", () => {
  const page = read("app/trip/feedback/[token]/page.tsx");
  const form = read("components/trips/trip-feedback-form.tsx");
  const route = read("app/api/trips/feedback/route.ts");
  assert.match(page, /index: false, follow: false/);
  assert.match(page, /getTripFeedbackInvite\(token\)/);
  assert.match(form, /\/api\/trips\/feedback/);
  assert.match(form, /It will not change the itinerary automatically/);
  assert.match(form, /It allows feedback only/);
  assert.match(route, /action === "list"/);
  assert.match(route, /submitTripFeedback/);
});

test("owner feedback tools require the saved-trip owner credentials", () => {
  const workspace = read("components/trips/results-workspace.tsx");
  const inviteRoute = read("app/api/trips/feedback/invite/route.ts");
  const reviewRoute = read("app/api/trips/feedback/review/route.ts");
  assert.match(workspace, /feedbackCredentials=\{savedTripCredentials\}/);
  assert.match(workspace, /Invite traveler feedback/);
  assert.match(workspace, /View feedback/);
  assert.match(inviteRoute, /createTripFeedbackInvite/);
  assert.match(reviewRoute, /reviewTripFeedback/);
  assert.match(reviewRoute, /409/);
});

test("owner-approved suggestion patch accepts only supported activity and dining edits", () => {
  const patch = normalizeTripFeedbackApplyPatch({ action: "reschedule-place", destinationIndex: 0, itemIndex: 0, date: "2026-12-27", time: "14:30" });
  assert.deepEqual(patch, { action: "reschedule-place", destinationIndex: 0, itemIndex: 0, date: "2026-12-27", time: "14:30" });
  assert.equal(normalizeTripFeedbackApplyPatch({ action: "reschedule-place", destinationIndex: 0, itemIndex: 0, date: "2026-12-32" }), null);
  assert.equal(normalizeTripFeedbackApplyPatch({ action: "remove-flight", destinationIndex: 0, itemIndex: 0 }), null);
  assert.equal(normalizeTripFeedbackApplyPatch({ action: "reschedule-place", destinationIndex: 99, itemIndex: 0, date: "2026-12-27" }), null);
});

test("owner-approved suggested date edit changes only the selected itinerary place", () => {
  const search = { departureDate: "2026-12-26", returnDate: "2026-12-28" };
  const snapshot = { version: 1, title: "Trip", destinations: [{ label: "Las Terrenas", items: [
    { kind: "activity", title: "Waterfall tour", subtitle: "Tour", date: "2026-12-26", time: "Morning", details: [], selectionRef: { type: "experience", kind: "activity", name: "Waterfall tour", address: "", category: "Tour", date: "2026-12-26", slot: "Morning" } },
    { kind: "restaurant", title: "Dinner", subtitle: "Dining", date: "2026-12-27", time: "19:00", details: [], selectionRef: { type: "experience", kind: "restaurant", name: "Dinner", address: "", category: "Dining", date: "2026-12-27", slot: "Dinner", time: "19:00" } },
  ] }] };
  const patch = normalizeTripFeedbackApplyPatch({ action: "reschedule-place", destinationIndex: 0, itemIndex: 0, date: "2026-12-27", time: "14:30" });
  const result = applyTripFeedbackPatchToSnapshot(snapshot, search, patch);
  assert.equal(result.snapshot.destinations[0].items[0].date, "2026-12-27");
  assert.equal(result.snapshot.destinations[0].items[0].time, "14:30");
  assert.equal(result.snapshot.destinations[0].items[0].selectionRef.date, "2026-12-27");
  assert.equal(result.snapshot.destinations[0].items[0].sortTimestamp, undefined);
  assert.equal(result.snapshot.destinations[0].items[1].date, "2026-12-27");
  assert.match(result.summary, /Moved Waterfall tour/);
});

test("owner-approved remove suggestion cannot remove flights, hotels or unrelated items", () => {
  const search = { departureDate: "2026-12-26", returnDate: "2026-12-28" };
  const snapshot = { version: 1, title: "Trip", destinations: [{ label: "Trip", items: [
    { kind: "outbound-flight", title: "Flight", details: [] },
    { kind: "activity", title: "Museum", date: "2026-12-27", details: [], selectionRef: { type: "experience", kind: "activity", name: "Museum", address: "", category: "Museum", date: "2026-12-27", slot: "Afternoon" } },
  ] }] };
  const patch = normalizeTripFeedbackApplyPatch({ action: "remove-place", destinationIndex: 0, itemIndex: 1 });
  const result = applyTripFeedbackPatchToSnapshot(snapshot, search, patch);
  assert.deepEqual(result.snapshot.destinations[0].items.map((item) => item.title), ["Flight"]);
  assert.throws(() => applyTripFeedbackPatchToSnapshot(snapshot, search, { action: "remove-place", destinationIndex: 0, itemIndex: 0 }), /TRIP_FEEDBACK_TARGET_INVALID/);
});

test("owner suggestion application is revision-checked, recorded, and requires a preview/confirm UI", () => {
  const db = read("lib/db/saved-trips.ts");
  const route = read("app/api/trips/feedback/apply/route.ts");
  const workspace = read("components/trips/results-workspace.tsx");
  assert.match(db, /s\.updated_at = \$\{expectedUpdatedAt\}::timestamptz/);
  assert.match(db, /applied_at = now\(\)/);
  assert.match(db, /applied_patch =/);
  assert.match(db, /locked_feedback AS MATERIALIZED/);
  assert.match(db, /FOR UPDATE/);
  assert.match(route, /applyTripFeedbackEdit/);
  assert.match(route, /409/);
  assert.match(workspace, /Preview change/);
  assert.match(workspace, /Preview — nothing has changed yet/);
  assert.match(workspace, /Confirm and apply edit/);
  assert.match(workspace, /approvedEdit: true/);
});

test("roadmap tracks browser identity, atomic quota accounting, and the completed feedback workflow", () => {
  const roadmap = read("docs/PRODUCT-ROADMAP.md");
  assert.match(roadmap, /\[x\] Use a persistent anonymous browser identity/);
  assert.match(roadmap, /\[x\] Reserve visitor\/IP quotas and create a new saved-trip record in one atomic SQL statement/);
  assert.match(roadmap, /\[x\] Let owners prepare a suggested activity\/dining change/);
});
