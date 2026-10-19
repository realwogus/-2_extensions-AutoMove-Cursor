const DEFAULT_ENABLED = true;
const ICONS = {
  enabled: {
    16: "icons/enabled16.png",
    32: "icons/enabled32.png",
  },
  disabled: {
    16: "icons/disabled16.png",
    32: "icons/disabled32.png",
  },
};
let toggleQueue = Promise.resolve();

async function getEnabled() {
  const { enabled = DEFAULT_ENABLED } = await chrome.storage.local.get("enabled");
  return enabled;
}

async function updateAction(enabled) {
  await Promise.all([
    chrome.action.setIcon({ path: enabled ? ICONS.enabled : ICONS.disabled }),
    chrome.action.setTitle({
      title: `Convenient Cursor: ${enabled ? "켜짐" : "꺼짐"}`,
    }),
  ]);
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get("enabled");
  const enabled = stored.enabled ?? DEFAULT_ENABLED;

  if (stored.enabled === undefined) {
    await chrome.storage.local.set({ enabled });
  }

  await updateAction(enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  await updateAction(await getEnabled());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.enabled?.newValue !== undefined) {
    void updateAction(Boolean(changes.enabled.newValue));
  }
});

chrome.action.onClicked.addListener(() => {
  toggleQueue = toggleQueue.then(async () => {
    const enabled = !(await getEnabled());
    await chrome.storage.local.set({ enabled });
    await updateAction(enabled);
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "focus-chat-input") return;
  if (!(await getEnabled())) return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch {
    // Browser-internal pages and extension stores do not allow script injection.
  }
});
