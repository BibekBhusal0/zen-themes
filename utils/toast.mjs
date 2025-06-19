const messages = {
  test: "This is toast.",
  "gh-success": "Copied Github Repo.",
  "gh-fail": "Failed to copy Github Repo.",
  "gh-not-found": "Not a Github Repo",
  "search-engene-not-found": "Not a recognized search engine.",
  "searching-google": "Searching in Google",
  "searching-duckduckgo": "Searching in DuckDuckGo",
  "no-search-query-found": "No search query found.",
  "search-fail": "Failed to search.",
  "minimize-memory-usage": "Memory use Minimized",
  "tabs-closed": "Tabs Closed",
};

const priorities = {
  warn: {
    emoji: "⚠️",
    icon: "M2.725 21q-.275 0-.5-.137t-.35-.363t-.137-.488t.137-.512l9.25-16q.15-.25.388-.375T12 3t.488.125t.387.375l9.25 16q.15.25.138.513t-.138.487t-.35.363t-.5.137zm1.725-2h15.1L12 6zM12 18q.425 0 .713-.288T13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18m0-3q.425 0 .713-.288T13 14v-3q0-.425-.288-.712T12 10t-.712.288T11 11v3q0 .425.288.713T12 15m0-2.5",
  },
  error: {
    emoji: "❌",
    icon: "M12 17q.425 0 .713-.288T13 16t-.288-.712T12 15t-.712.288T11 16t.288.713T12 17m0-4q.425 0 .713-.288T13 12V8q0-.425-.288-.712T12 7t-.712.288T11 8v4q0 .425.288.713T12 13m0 9q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8",
  },
  info: {
    emoji: "ℹ️",
    icon: "M12 17q.425 0 .713-.288T13 16v-4q0-.425-.288-.712T12 11t-.712.288T11 12v4q0 .425.288.713T12 17m0-8q.425 0 .713-.288T13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9m0 13q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8",
  },
  success: {
    emoji: "✅",
    icon: "m10.6 13.8l-2.15-2.15q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7L9.9 15.9q.3.3.7.3t.7-.3l5.65-5.65q.275-.275.275-.7t-.275-.7t-.7-.275t-.7.275zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8",
  },
};

function getSvgCss(path) {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='${path}' /%3E%3C/svg%3E")`;
}

let toastStyleInjected = false;

function injectToastStyles() {
  if (toastStyleInjected) return;

  const style = document.createElement("style");

  const messageStyles = Object.entries(messages).map(([key, message]) => {
    const id = `toast-${key}`;
    return `
      label[data-l10n-id="${id}"]::after {
        content: "${message} ";
      }
    `;
  });

  const iconStyles = Object.entries(priorities).map(([priority, icon]) => {
    if (icon.icon) {
      return `
      .toast-priority-${priority}
      {
        &::before {
          content: "";
          display: inline-block;
          vertical-align: middle;
          width: 1.4em;
          height: 1.4em;
          background-image: ${getSvgCss(icon.icon)};
          background-repeat: no-repeat;
          background-size: contain;
        }
        display: flex;
        gap: 1em;
        justify-content:center;
      }
    `;
    } else {
      return `
      .toast-priority-${priority}::before {
        content: "${icon.emoji}";
        margin-right: 0.4em;
      }
    `;
    }
  });

  style.textContent = [...messageStyles, ...iconStyles].join("\n");
  document.head.appendChild(style);
  toastStyleInjected = true;
}

export function showToast(key = "hello", priority, extraOptions = {}) {
  injectToastStyles();
  const validKey = messages.hasOwnProperty(key) ? key : "test";
  const validPriority =
    priority && priorities.hasOwnProperty(priority) ? priority : null;

  const options = {
    custom: true,
    ...extraOptions,
  };

  if (validPriority) options.priority = validPriority;

  gZenUIManager.showToast(`toast-${validKey}`, options);

  const toastElement = document.querySelector(
    `label[data-l10n-id="toast-${validKey}"]`,
  );
  if (toastElement && validPriority) {
    toastElement.classList.add(`toast-priority-${validPriority}`);
  }
}
