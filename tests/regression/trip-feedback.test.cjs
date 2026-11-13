const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeTripFeedbackSubmission, isTripFeedbackStatus } = require("../../.test-build/lib/trip-planner/trip-feedback.js");

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
  assert.match(db, /stale: new Date\(row\.base_updated_at\)/);
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

test("roadmap tracks the initial feedback slice and leaves owner-approved itinerary patches open", () => {
  const roadmap = read("docs/PRODUCT-ROADMAP.md");
  assert.match(roadmap, /\[x\] Add invite-only traveler feedback links/);
  assert.match(roadmap, /\[x\] Add an owner-only feedback inbox/);
  assert.match(roadmap, /\[ \] Let owners apply a suggested itinerary edit/);
});
