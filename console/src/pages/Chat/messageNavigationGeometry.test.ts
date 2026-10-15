import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveAnchorId,
  getMessageElementInScrollContainer,
  scrollTargetIntoContainerTop,
} from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Chat/MessageList/UserMessageAnchors/helpers";
import type { UserMessageAnchor } from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Chat/MessageList/UserMessageAnchors/types";

const anchors: UserMessageAnchor[] = Array.from({ length: 45 }, (_, index) => ({
  id: `question:${index}.user`,
  preview: `Question ${index}`,
  attachments: [],
  orderPercent: ((index + 0.5) / 45) * 100,
}));

function createScroller(reverse = true) {
  const scroller = document.createElement("div");
  scroller.className = reverse
    ? "bubble-list-order-desc"
    : "bubble-list-order-asc";
  scroller.scrollTop = reverse ? -4000 : 4000;
  scroller.getBoundingClientRect = () => new DOMRect(0, 100, 800, 600);
  Object.defineProperties(scroller, {
    scrollHeight: { value: 20000 },
    clientHeight: { value: 600 },
  });
  document.body.append(scroller);
  return scroller;
}

function appendMessage(scroller: HTMLElement, id: string, top: number) {
  const message = document.createElement("div");
  message.id = id;
  message.dataset.role = id.endsWith(".user") ? "user" : "assistant";
  message.getBoundingClientRect = () => new DOMRect(0, top, 700, 40);
  scroller.append(message);
  return message;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("installed SDK message navigation geometry", () => {
  it.each([true, false])(
    "keeps the preceding question active throughout a long answer (reverse=%s)",
    (reverse) => {
      const scroller = createScroller(reverse);
      anchors.forEach((anchor, index) => {
        const top =
          index <= 20 ? (index - 20) * 500 - 3500 : (index - 21) * 500 + 550;
        appendMessage(scroller, anchor.id, top);
      });

      expect(getActiveAnchorId(scroller, anchors)).toBe(anchors[20].id);
    },
  );

  it("changes sections when the next question reaches the visible header edge", () => {
    const scroller = createScroller();
    appendMessage(scroller, anchors[20].id, -1500);
    const next = appendMessage(scroller, anchors[21].id, 180);

    expect(getActiveAnchorId(scroller, anchors, 60)).toBe(anchors[20].id);
    next.getBoundingClientRect = () => new DOMRect(0, 160, 700, 40);
    expect(getActiveAnchorId(scroller, anchors, 60)).toBe(anchors[21].id);
  });

  it("uses the first rendered section when no question has reached the top", () => {
    const scroller = createScroller();
    appendMessage(scroller, anchors[10].id, 300);
    appendMessage(scroller, anchors[11].id, 700);

    expect(getActiveAnchorId(scroller, anchors)).toBe(anchors[10].id);
  });

  it("identifies a paginated answer whose preceding question is not rendered", () => {
    const scroller = createScroller();
    const messageIds = anchors.flatMap((anchor) => [
      anchor.id,
      `${anchor.id}:answer`,
    ]);
    appendMessage(scroller, `${anchors[20].id}:answer`, -500);
    appendMessage(scroller, anchors[21].id, 500);

    expect(
      getActiveAnchorId(scroller, anchors, 0, undefined, undefined, messageIds),
    ).toBe(anchors[20].id);
  });

  it.each([
    { reverse: true, scrollTop: 0, expected: 30 },
    { reverse: true, scrollTop: -19400, expected: 10 },
    { reverse: false, scrollTop: 0, expected: 10 },
    { reverse: false, scrollTop: 19400, expected: 30 },
  ])(
    "uses rendered boundaries at $scrollTop (reverse=$reverse)",
    ({ reverse, scrollTop, expected }) => {
      const scroller = createScroller(reverse);
      appendMessage(scroller, anchors[10].id, -500);
      appendMessage(scroller, anchors[30].id, 500);
      scroller.scrollTop = scrollTop;

      expect(getActiveAnchorId(scroller, anchors)).toBe(anchors[expected].id);
    },
  );

  it("locates punctuation in message IDs without interpreting it as a selector", () => {
    const scroller = createScroller();
    const target = appendMessage(scroller, anchors[20].id, 500);

    expect(getMessageElementInScrollContainer(scroller, anchors[20].id)).toBe(
      target,
    );
  });

  it.each([true, false])(
    "aligns the real target below the header (reverse=%s)",
    (reverse) => {
      const scroller = createScroller(reverse);
      const target = appendMessage(scroller, anchors[20].id, 560);
      scroller.scrollBy = vi.fn();

      scrollTargetIntoContainerTop(scroller, target, "auto", 60);

      expect(scroller.scrollBy).toHaveBeenCalledWith({
        top: 400,
        behavior: "auto",
      });
    },
  );
});
