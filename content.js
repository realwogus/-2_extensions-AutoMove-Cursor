// SPDX-License-Identifier: MPL-2.0

(function focusChatInput() {
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
      "input[type='text']",
      "input[type='search']",
      "input[type='url']",
      "input[type='email']",
      "input:not([type])",
      "[contenteditable='true']",
      "[contenteditable='plaintext-only']",
    ].join(",");

    const found = [...root.querySelectorAll(selector)];

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) found.push(...editableElements(element.shadowRoot));
    }

    return found;
  }

  function placeCaretAtEnd(element) {
    element.focus({ preventScroll: true });

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
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

  const candidates = editableElements().filter(
    (element) => isEditable(element) && isVisible(element),
  );
  const best = candidates.sort((a, b) => score(b) - score(a))[0];

  if (best) {
    placeCaretAtEnd(best);
    best.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
})();
