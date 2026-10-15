# Chat SDK navigation patch

`@agentscope-ai+chat+1.2.0-beta.1791860734622.patch` fixes
[QwenPaw #8251](https://github.com/agentscope-ai/QwenPaw/issues/8251) in the
pinned SDK's distributed `lib` entry points and their type declarations.
`npm ci` / `npm install` applies it through `patch-package --error-on-fail`.

The patch keeps current-message selection tied to the section containing the
viewport's visible top, including assistant messages whose user bubble is outside
the rendered history window. Directory positioning uses actual rectangles within
the directory's own scroll container. Locate remeasures the transcript on demand,
and navigation releases its lock independently of the temporary target highlight.
Minimap markers use measured positions only.

Bubble flex items keep their intrinsic height while `content-visibility` skips
offscreen content. A transient scroll boundary must settle before navigation
finishes, and completion stops any remaining native smooth scroll. These changes
prevent history reflow from moving a highlighted target away after alignment.

The SDK's existing wheel, touch, pointer, and keyboard cancellation is retained.
The matching behavior tests import the installed SDK directly:

```sh
npm run test:run -- src/pages/Chat/messageNavigationGeometry.test.ts src/pages/Chat/messageNavigation.integration.test.tsx
```

When upgrading the SDK, first check whether the upstream release includes these
fixes. Remove or regenerate this exact-version patch, then run the regressions.
Do not edit `node_modules` without regenerating the patch:

```sh
npx patch-package @agentscope-ai/chat
```
