const getPref = (key, defaultValue) => {
  try {
    const pref = UC_API.Prefs.get(key);
    if (!pref) return defaultValue;
    if (!pref.exists()) return defaultValue;
    return pref.value;
  } catch {
    return defaultValue;
  }
};

const debugLog = (...args) => {
  if (getPref("extensions.findbar-ai.debug-mode", false)) {
    console.log(...args);
  }
};

debugLog("findbar: Window Manager child loaded");

export class FindbarAIWindowManagerChild extends JSWindowActorChild {
  constructor() {
    super();
  }

  handleEvent(event) {
    debugLog(`findbar: child handling event: ${event.type}`);
    if (event.type === "DOMContentLoaded") {
      this.sendAsyncMessage("FindbarAI:ContentLoaded", {
        url: this.document.location.href,
        title: this.document.title,
      });
    }
  }

  async receiveMessage(message) {
    debugLog(`findbar: child received message: ${message.name}`);
    switch (message.name) {
      case "FindbarAI:GetPageHTMLContent":
        return {
          content: this.document.documentElement.outerHTML,
          url: this.document.location.href,
          title: this.document.title,
        };

      case "FindbarAI:GetSelectedText":
        const selection = this.contentWindow.getSelection();
        return {
          selectedText: selection.toString(),
          hasSelection: !selection.isCollapsed,
        };

      case "FindbarAI:GetPageTextContent":
        return {
          textContent: this.extractTextContent(),
          url: this.document.location.href,
          title: this.document.title,
        };

      default:
        debugLog(`findbar: child unhandled message: ${message.name}`);
    }
  }

  extractTextContent() {
    const clonedDocument = this.document.cloneNode(true);
    const elementsToRemove = clonedDocument.querySelectorAll(
      "script, style, noscript, iframe, svg, canvas, input, textarea, select",
    );
    elementsToRemove.forEach((el) => el.remove());
    const textContent = clonedDocument.body.innerText
      .replace(/\s+/g, " ")
      .trim();
    return textContent;
  }
}
