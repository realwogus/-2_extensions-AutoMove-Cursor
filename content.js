// SPDX-License-Identifier: MPL-2.0

(function toggleChatInputFocus() {
  const CHAT_WORDS = [
    "chat",
    "message",
    "prompt",
    "ask",
    "send",
    "reply",
    "질문",
    "메시지",
    "대화",
    "입력",
    "보내기",
  ];

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= innerHeight ||
      rect.left >= innerWidth ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    if (typeof element.checkVisibility === "function") {
      return element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      });
    }

    return true;
  }

  function isEditable(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches(":disabled, [aria-disabled='true'], [readonly]")) {
      return false;
    }

    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) {
      return ["text", "search", "url", "email", ""].includes(element.type);
    }

    return element.isContentEditable;
  }

  function activeElement() {
    let active = document.activeElement;

    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    return active;
  }

  function focusedEditable() {
    const active = activeElement();
    if (!(active instanceof HTMLElement)) return null;
    if (isEditable(active)) return active;

    return active.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
  }

  function composedParent(element) {
    if (element.parentElement) return element.parentElement;

    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }

  function allElements(root = document) {
    const elements = [...root.querySelectorAll("*")];
    const found = [...elements];

    for (const element of elements) {
      if (element.shadowRoot) found.push(...allElements(element.shadowRoot));
    }

    return found;
  }

  function isScrollable(element) {
    if (!(element instanceof HTMLElement) || isEditable(element)) return false;

    const { overflowY } = getComputedStyle(element);
    return (
      ["auto", "scroll", "overlay"].includes(overflowY) &&
      element.scrollHeight > element.clientHeight + 1 &&
      isVisible(element)
    );
  }

  function isPrimaryScrollArea(element) {
    const isPageScroller =
      element === document.scrollingElement &&
      element.scrollHeight > element.clientHeight + 1;

    if (!isPageScroller && !isScrollable(element)) return false;

    const minimumHeight = Math.min(240, innerHeight * 0.4);
    return element.getBoundingClientRect().height >= minimumHeight;
  }

  function scrollTargetFor(source) {
    for (let parent = composedParent(source); parent; parent = composedParent(parent)) {
      if (isPrimaryScrollArea(parent)) return parent;
    }

    const sourceRect = source.getBoundingClientRect();
    const sourceCenterX = (sourceRect.left + sourceRect.right) / 2;
    const viewportArea = Math.max(innerWidth * innerHeight, 1);
    const scrollableElements = allElements().filter(isScrollable);
    const pageScroller = document.scrollingElement;

    if (
      pageScroller instanceof HTMLElement &&
      pageScroller.scrollHeight > pageScroller.clientHeight + 1 &&
      !scrollableElements.includes(pageScroller)
    ) {
      scrollableElements.push(pageScroller);
    }

    const primaryAreas = scrollableElements.filter(isPrimaryScrollArea);
    const candidates = primaryAreas.length > 0 ? primaryAreas : scrollableElements;

    const scoreScrollTarget = (element) => {
      const rect = element.getBoundingClientRect();
      const containsSourceX = rect.left <= sourceCenterX && sourceCenterX <= rect.right;
      const centerX = (rect.left + rect.right) / 2;
      let points = 0;

      if (containsSourceX) points += 200;
      points += (rect.width * rect.height) / viewportArea * 80;
      points += rect.width / Math.max(innerWidth, 1) * 40;
      points += rect.height / Math.max(innerHeight, 1) * 30;
      points -= Math.abs(centerX - sourceCenterX) / Math.max(innerWidth, 1) * 100;

      return points;
    };

    return candidates.sort((a, b) => scoreScrollTarget(b) - scoreScrollTarget(a))[0]
      ?? document.scrollingElement;
  }

  function focusForScrolling(element) {
    if (!(element instanceof HTMLElement)) return;

    const hadTabIndex = element.hasAttribute("tabindex");
    if (!hadTabIndex) element.setAttribute("tabindex", "-1");

    element.focus({ preventScroll: true });

    if (!hadTabIndex) element.removeAttribute("tabindex");
  }

  function accessibleText(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
      element.getAttribute("data-placeholder"),
      element.getAttribute("title"),
      element.id,
      element.className,
    ]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();
  }

  function score(element) {
    const rect = element.getBoundingClientRect();
    const text = accessibleText(element);
    const viewportWidth = Math.max(innerWidth, 1);
    const viewportHeight = Math.max(innerHeight, 1);
    let points = 0;

    if (element instanceof HTMLTextAreaElement) points += 40;
    if (element.isContentEditable) points += 35;
    if (element.getAttribute("role") === "textbox") points += 25;
    if (element instanceof HTMLInputElement) points += 5;
    if (element.getAttribute("aria-multiline") === "true") points += 20;
    if (CHAT_WORDS.some((word) => text.includes(word))) points += 60;

    // Chat composers are usually wide and close to the viewport's bottom edge.
    points += Math.min(rect.width / viewportWidth, 1) * 20;
    points += Math.max(0, 1 - Math.abs(viewportHeight - rect.bottom) / viewportHeight) * 35;

    if (element.closest("[role='dialog'], dialog")) points += 25;

    return points;
  }

  function editableElements(root = document) {
    const selector = [
      "textarea",
      "input",
      "[contenteditable]",
    ].join(",");

    const found = [...root.querySelectorAll(selector)];

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) found.push(...editableElements(element.shadowRoot));
    }

    return found;
  }

  function placeCaretAtEnd(element) {
    element.focus({ preventScroll: true });

    if (element instanceof HTMLTextAreaElement) {
      const end = element.value.length;
      element.setSelectionRange(end, end);
      return;
    }

    if (
      element instanceof HTMLInputElement &&
      ["text", "search", "url", "tel", "password"].includes(element.type)
    ) {
      const end = element.value.length;
      element.setSelectionRange(end, end);
      return;
    }

    if (element.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  const focused = focusedEditable();

  if (focused) {
    const scrollTarget = scrollTargetFor(focused);
    focused.blur();
    focusForScrolling(scrollTarget);
    return;
  }

  const candidates = editableElements().filter(
    (element) => isEditable(element) && isVisible(element),
  );
  const best = candidates.sort((a, b) => score(b) - score(a))[0];

  if (best) {
    placeCaretAtEnd(best);
    best.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
})();
