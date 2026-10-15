# Issue #8251: message navigation accuracy

## Agreed scope

Fix the Console message directory in long conversations without replacing the
chat interface. The user approved this plan on 2026-10-15.

Issue: https://github.com/agentscope-ai/QwenPaw/issues/8251

## Findings

- The navigation implementation belongs to `@agentscope-ai/chat`, pinned to
  `1.2.0-beta.1791860734622`. PR #8214 upgraded this dependency to include
  scroll-intent cancellation; no newer beta is published at the time of inspection.
- `getActiveAnchorId` chooses the user bubble nearest the viewport top. During a
  long answer, this can select the next question before the reader reaches it.
  This defect was reproduced against the exact pinned package.
- The directory centers its active item using `offsetTop`, which is relative to
  an offset parent rather than necessarily the directory's scroll container.
  Its opening effect does not react to an active message discovered later, and
  the locate button is disabled until the cached active ID exists.
- `orderPercent` is a minimap fallback, not the transcript jump coordinate.
  Transcript navigation already locates the target by message ID and measures its
  DOM rectangle. Directory item refs are separate from transcript element lookup.
- Navigation holds its active-message lock through the highlight timeout after
  alignment finishes. Completion, cancellation, and subsequent navigation need
  distinct cleanup so manual scrolling cannot revive a completed jump.
- The host wheel handler calls `preventDefault` but lets the event propagate to
  the SDK's scroll-intent listener. Its propagation is not the cause.
- Real-browser verification also reproduced collapsed offscreen bubbles:
  `content-visibility: auto` allowed reversed flex items to shrink to zero height.
  Revealing them changed the scroll geometry during navigation. Keep their
  intrinsic heights, require a stable boundary before finishing, and stop the
  completed native smooth scroll. The same failure occurred with native SDK
  Markdown, independently of custom fixture cards.

## Implementation

1. Add behavior regressions against the installed SDK, including more than 40
   messages with uneven response heights and paginated history.
2. Apply a focused, versioned SDK patch using `patch-package` and an install hook.
   Fix active-message geometry, center directory entries relative to the actual
   directory viewport, resolve locate requests from current transcript geometry,
   and release navigation state when alignment completes or user input interrupts.
3. Keep unloaded minimap entries out of measured coordinates; reveal historical
   messages before measuring and jumping to their actual elements. Preserve
   offscreen bubble heights and wait for history reflow at scroll boundaries.
4. Verify installation reapplies the patch, run regressions, type checks, relevant
   formatting checks, a production Console build, and browser interaction checks.

## Acceptance criteria

- Reading a long answer keeps its preceding question active until the next
  question reaches the visible top edge, including when the header overlaps it.
- Clicking an older entry reveals it and aligns its real bubble within the
  available scroll bounds. A later click supersedes an earlier pending jump.
- Opening or locating in the directory works even when the previous measurement
  has not produced an active ID. Directory positioning uses its own scroll space.
- Wheel, touch, scrollbar, and navigation-key input interrupt a pending jump.
  Completed navigation leaves no alignment loop or active-ID lock behind.
- Windows reverse scrolling, ordinary scrolling, and DOM IDs with punctuation
  are covered without filesystem- or operating-system-specific implementation.

## Checklist

- [x] Inspect issue #8251, PR #8214, host integration, and the exact pinned SDK.
- [x] Reproduce incorrect active-message selection with a long answer.
- [x] Confirm the existing scroll/configuration baseline: 10 tests pass.
- [x] Obtain user agreement and save this plan under `docs/plans/`.
- [x] Add failing regression tests for navigation and directory positioning.
- [x] Implement and persist the focused SDK patch.
- [x] Reproduce and fix browser-only bubble collapse and transient boundaries.
- [x] Verify clean installation and patch reapplication.
- [x] Pass navigation regressions and related integration tests.
- [x] Pass type checks and frontend formatting checks.
- [x] Verify long-session interactions in a browser and record the results.
- [ ] Repeat the full frontend suite and production build after the final
  browser-driven sizing and boundary fixes.

## Verification results

- Before the patch, 11 of the 26 initial SDK regressions failed. The failures
  reproduced early section selection, directory coordinate errors, disabled
  locate, late measurement not recentering, retained active locks, and fabricated
  minimap positions.
- After the patch and additional cleanup/reflow regressions, 52 tests pass
  across the two navigation files, `messageScroll`, `longChatPerformance`, and
  `sdkSessionLifecycle.integration`.
- `npx tsc -b --noEmit` passes.
- ESLint passes for both new regression files.
- Prettier checks pass for both test files, package files, and patch README.
- A clean `npm ci` reapplies the final four-file patch successfully.
- Chromium browser checks pass at 1280x900 and 820x1000 using 50 questions,
  native SDK Markdown, real history pagination, and the Console wheel handler.
  Historical jumps, rapid replacement, reading within long answers, directory
  locate, and wheel interruption pass without runtime errors. Non-boundary
  targets align within 1px; the first message reaches the physical scroll limit.
  The 375x812 layout has no horizontal overflow and retains the SDK's existing
  hidden navigator behavior at narrow widths. These are local SDK fixture checks,
  not a Windows desktop or backend session test.
- The earlier iteration passed all 5,093 frontend tests and the production build.
  Repeat these checks for the final sizing/boundary changes and new regression.
- The versioned patch changes four distributed SDK files: navigation,
  geometry helpers, the matching helper declaration, and bubble flex sizing.
