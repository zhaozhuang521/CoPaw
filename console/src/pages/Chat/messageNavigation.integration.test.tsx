/** Exercise the installed SDK navigator; only the popover shell is stubbed. */
import { useState, type ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserMessageAnchors from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Chat/MessageList/UserMessageAnchors";
import type { UserMessageAnchorsProps } from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Chat/MessageList/UserMessageAnchors/types";

vi.mock("@agentscope-ai/design", () => ({
  Popover: ({
    children,
    content,
    onOpenChange,
  }: {
    children: ReactNode;
    content: ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <div
        onMouseEnter={() => {
          setOpen(true);
          onOpenChange(true);
        }}
      >
        {children}
        {open && content}
      </div>
    );
  },
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

const PREFIX = "navigation-test";
const SCROLL_CLASS = `${PREFIX}-scroll`;
const QUESTION_COUNT = 45;
const questionId = (index: number) => `question:${index}.user`;
const answerId = (index: number) => `answer:${index}.assistant`;
const questionOffset = (index: number) => index * 500 + (index > 20 ? 4000 : 0);
const items: UserMessageAnchorsProps["items"] = Array.from(
  { length: QUESTION_COUNT },
  (_, index) => [
    {
      id: questionId(index),
      role: "user" as const,
      cards: [
        {
          code: "AgentScopeRuntimeRequestCard",
          data: {
            input: [{ content: [{ type: "text", text: `Question ${index}` }] }],
          },
        },
      ],
    },
    { id: answerId(index), role: "assistant" as const },
  ],
)
  .flat()
  .reverse();

function createFixture({
  reverse = true,
  renderedIds = items.map((item) => item.id),
  ensure = vi.fn(async () => {}),
  variant = "navigator",
}: {
  reverse?: boolean;
  renderedIds?: string[];
  ensure?: UserMessageAnchorsProps["onEnsureMessageVisible"];
  variant?: UserMessageAnchorsProps["variant"];
} = {}) {
  const root = document.createElement("div");
  root.className = PREFIX;
  const scroller = document.createElement("div");
  scroller.className = `${SCROLL_CLASS} bubble-list-order-${
    reverse ? "desc" : "asc"
  }`;
  const scrollHeight = 27000;
  const maxScrollTop = scrollHeight - 600;
  const visualScrollTop = () =>
    reverse ? maxScrollTop + scroller.scrollTop : scroller.scrollTop;
  const setVisualScrollTop = (value: number) => {
    scroller.scrollTop = reverse ? value - maxScrollTop : value;
  };
  const applyScroll = (top: number) => {
    scroller.scrollTop = reverse
      ? Math.max(-maxScrollTop, Math.min(0, top))
      : Math.max(0, Math.min(maxScrollTop, top));
  };
  Object.defineProperties(scroller, {
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: 600 },
  });
  root.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 800);
  scroller.getBoundingClientRect = () => new DOMRect(0, 100, 800, 600);
  scroller.scrollBy = vi.fn(
    (options?: ScrollToOptions | number, y?: number) => {
      const delta = typeof options === "number" ? y ?? 0 : options?.top ?? 0;
      applyScroll(scroller.scrollTop + delta);
    },
  );
  scroller.scrollTo = vi.fn(
    (options?: ScrollToOptions | number, y?: number) => {
      const top = typeof options === "number" ? y : options?.top;
      applyScroll(top ?? scroller.scrollTop);
    },
  );
  const showMessages = (ids: string[]) => {
    scroller.replaceChildren(
      ...ids.map((id) => {
        const message = document.createElement("div");
        const index = Number(id.split(":")[1].split(".")[0]);
        const user = id.startsWith("question");
        message.id = id;
        message.dataset.role = user ? "user" : "assistant";
        const offset = questionOffset(index) + (user ? 0 : 40);
        message.getBoundingClientRect = () =>
          new DOMRect(
            0,
            100 + offset - visualScrollTop(),
            700,
            user ? 40 : 460,
          );
        return message;
      }),
    );
  };
  showMessages(renderedIds);
  setVisualScrollTop(questionOffset(20) + 4000);
  root.append(scroller);
  document.body.append(root);
  const mounted = render(
    <UserMessageAnchors
      items={items}
      minCount={1}
      onEnsureMessageVisible={ensure}
      prefixCls={PREFIX}
      renderedItemsKey="fixture"
      scrollContainerClassName={SCROLL_CLASS}
      variant={variant}
    />,
    { container: root.appendChild(document.createElement("div")) },
  );
  return {
    root,
    scroller,
    ensure,
    showMessages,
    setVisualScrollTop,
    ...mounted,
  };
}

function openDirectory(root: HTMLElement) {
  fireEvent.mouseEnter(
    screen.getByRole("button", { name: "Open user message directory" }),
  );
  const list = root.querySelector<HTMLElement>(
    `.${PREFIX}-anchor-directory-list`,
  )!;
  list.scrollTop = 120;
  Object.defineProperties(list, {
    clientHeight: { value: 300 },
    scrollHeight: { value: QUESTION_COUNT * 60 },
  });
  list.getBoundingClientRect = () => new DOMRect(0, 320, 420, 300);
  list.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    const top = typeof options === "number" ? y : options?.top;
    list.scrollTop = top ?? list.scrollTop;
  });
  list
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button, index) => {
      button.getBoundingClientRect = () =>
        new DOMRect(0, 320 + index * 60 - list.scrollTop, 420, 60);
      Object.defineProperties(button, {
        offsetTop: { value: 7000 + index * 60 },
        offsetHeight: { value: 60 },
      });
    });
  return list;
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("installed SDK long-session navigation", () => {
  it("centers the active entry in the directory's own scroll space", async () => {
    const fixture = createFixture();
    const list = openDirectory(fixture.root);
    await advance(32);

    expect(list.scrollTo).toHaveBeenLastCalledWith({
      top: 1080,
      behavior: "auto",
    });
  });

  it("rechecks transcript geometry when locate is clicked before the next measurement", () => {
    const fixture = createFixture();
    const list = openDirectory(fixture.root);
    fixture.setVisualScrollTop(questionOffset(30) + 100);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Scroll directory to active user message",
      }),
    );

    expect(list.scrollTo).toHaveBeenLastCalledWith({
      top: 1680,
      behavior: "smooth",
    });
    expect(
      fixture.root.querySelector(`.${PREFIX}-anchor-directory-item-active`),
    ).toHaveTextContent("Question 30");
  });

  it("can locate when no active ID was available during the previous measurement", () => {
    const fixture = createFixture({ renderedIds: [] });
    const list = openDirectory(fixture.root);
    const locate = screen.getByRole("button", {
      name: "Scroll directory to active user message",
    });
    expect(locate).toBeEnabled();
    fixture.showMessages([questionId(20), answerId(20), questionId(21)]);
    fireEvent.click(locate);

    expect(list.scrollTo).toHaveBeenLastCalledWith({
      top: 1080,
      behavior: "smooth",
    });
  });

  it("centers an active message discovered after the directory was opened", async () => {
    const fixture = createFixture({ renderedIds: [] });
    const list = openDirectory(fixture.root);
    await advance(32);
    vi.mocked(list.scrollTo).mockClear();
    fixture.showMessages([questionId(30), answerId(30)]);
    fixture.setVisualScrollTop(questionOffset(30) + 100);
    fireEvent.scroll(fixture.scroller);
    await advance(64);
    await advance(32);

    expect(list.scrollTo).toHaveBeenLastCalledWith({
      top: 1680,
      behavior: "auto",
    });
  });

  it("reveals an unrendered historical message before aligning its real bubble", async () => {
    const ensure = vi.fn(async (id: string) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      fixture.showMessages([id, answerId(12)]);
    });
    const fixture = createFixture({
      renderedIds: [questionId(44), answerId(44)],
      ensure,
    });
    openDirectory(fixture.root);
    fireEvent.click(screen.getByRole("button", { name: "Question 12" }));
    await advance(240);

    expect(ensure).toHaveBeenCalledWith(questionId(12));
    expect(
      document.getElementById(questionId(12))!.getBoundingClientRect().top,
    ).toBe(100);
  });

  it("keeps the newest navigation when an earlier history reveal resolves later", async () => {
    let finishFirst!: () => void;
    const ensure = vi.fn((id: string) =>
      id === questionId(10)
        ? new Promise<void>((resolve) => {
            finishFirst = resolve;
          })
        : Promise.resolve(),
    );
    const fixture = createFixture({ ensure });
    openDirectory(fixture.root);
    fireEvent.click(screen.getByRole("button", { name: "Question 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Question 30" }));
    await advance(240);
    await act(async () => {
      finishFirst();
    });
    await advance(1800);

    expect(
      document.getElementById(questionId(30))!.getBoundingClientRect().top,
    ).toBe(100);
    expect(
      fixture.root.querySelector(`.${PREFIX}-anchor-directory-item-active`),
    ).toHaveTextContent("Question 30");
  });

  it("waits for a transient scroll boundary to settle after history reflows", async () => {
    const fixture = createFixture();
    const target = document.getElementById(questionId(10))!;
    const getSettledRect = target.getBoundingClientRect;
    let reflowed = false;
    target.getBoundingClientRect = () =>
      reflowed ? getSettledRect() : new DOMRect(0, 0, 700, 40);
    const applyScroll = fixture.scroller.scrollBy;
    fixture.scroller.scrollBy = vi.fn(
      (options?: ScrollToOptions | number, y?: number) => {
        if (!reflowed) fixture.setVisualScrollTop(0);
        else if (typeof options === "number") applyScroll(options, y ?? 0);
        else applyScroll(options);
      },
    );
    openDirectory(fixture.root);
    fireEvent.click(screen.getByRole("button", { name: "Question 10" }));
    setTimeout(() => {
      reflowed = true;
    }, 60);
    await advance(700);

    expect(target.getBoundingClientRect().top).toBe(100);
    expect(target).toHaveClass(`${PREFIX}-anchor-target-active`);
  });

  it.each(["wheel", "touchmove", "pointerdown", "keydown"])(
    "lets %s interrupt a pending jump without later corrections",
    async (eventType) => {
      const fixture = createFixture();
      fixture.scroller.scrollBy = vi.fn();
      openDirectory(fixture.root);
      fireEvent.click(screen.getByRole("button", { name: "Question 10" }));
      await advance(64);
      fixture.setVisualScrollTop(questionOffset(30) + 100);
      const manualScrollTop = fixture.scroller.scrollTop;
      const correctionCount = vi.mocked(fixture.scroller.scrollBy).mock.calls
        .length;
      fireEvent(
        fixture.scroller,
        eventType === "keydown"
          ? new KeyboardEvent(eventType, { key: "PageDown", bubbles: true })
          : new Event(eventType, { bubbles: true }),
      );
      await advance(2200);

      expect(fixture.scroller.scrollTop).toBe(manualScrollTop);
      expect(fixture.scroller.scrollBy).toHaveBeenCalledTimes(correctionCount);
      expect(
        fixture.root.querySelector(`.${PREFIX}-anchor-directory-item-active`),
      ).toHaveTextContent("Question 30");
    },
  );

  it("releases the active lock as soon as alignment finishes, before the highlight expires", async () => {
    const fixture = createFixture();
    openDirectory(fixture.root);
    fireEvent.click(screen.getByRole("button", { name: "Question 10" }));
    await advance(240);
    fixture.setVisualScrollTop(questionOffset(30) + 100);
    fireEvent.scroll(fixture.scroller);
    await advance(32);

    expect(
      fixture.root.querySelector(`.${PREFIX}-anchor-directory-item-active`),
    ).toHaveTextContent("Question 30");
  });

  it("clears the previous highlight on a new jump and the final highlight on unmount", async () => {
    const fixture = createFixture();
    openDirectory(fixture.root);
    fireEvent.click(screen.getByRole("button", { name: "Question 10" }));
    await advance(240);
    const previous = document.getElementById(questionId(10))!;
    expect(previous).toHaveClass(`${PREFIX}-anchor-target-active`);

    fireEvent.click(screen.getByRole("button", { name: "Question 30" }));
    expect(previous).not.toHaveClass(`${PREFIX}-anchor-target-active`);
    await advance(240);
    const current = document.getElementById(questionId(30))!;
    expect(current).toHaveClass(`${PREFIX}-anchor-target-active`);
    fixture.unmount();
    expect(current).not.toHaveClass(`${PREFIX}-anchor-target-active`);
  });

  it.each([true, false])(
    "shows only measured minimap anchors (reverse=%s)",
    async (reverse) => {
      createFixture({
        reverse,
        variant: "minimap",
        renderedIds: [questionId(20), answerId(20), questionId(21)],
      });
      await advance(32);
      const buttons = screen.getAllByRole("button", {
        name: /^Scroll to user message:/,
      });

      expect(buttons).toHaveLength(2);
      const expectedTop = ((questionOffset(20) + 20) / 27000) * 100;
      expect(Number.parseFloat(buttons[0].style.top)).toBeCloseTo(expectedTop);
    },
  );

  it("cancels pending alignment when the navigator unmounts", async () => {
    const fixture = createFixture();
    fixture.scroller.scrollBy = vi.fn();
    openDirectory(fixture.root);
    fireEvent.click(screen.getByRole("button", { name: "Question 10" }));
    await advance(64);
    const correctionCount = vi.mocked(fixture.scroller.scrollBy).mock.calls
      .length;
    fixture.unmount();
    await advance(2200);

    expect(fixture.scroller.scrollBy).toHaveBeenCalledTimes(correctionCount);
    expect(
      fixture.root.querySelector(`.${PREFIX}-anchor-target-active`),
    ).toBeNull();
  });
});
