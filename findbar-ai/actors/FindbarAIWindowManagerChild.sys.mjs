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
  if (getPref("extension.findbar-ai.debug-mode", false)) {
    console.log(...args);
  }
};

debugLog("findbar: Window Manager child loaded");

export class FindbarAIWindowManagerChild extends JSWindowActorChild {
  constructor() {
    super();
    this._currentHighlight = null;
  }

  // handleEvent(event) {
  //   debugLog(`findbar: child handling event: ${event.type}`);
  //   if (event.type === "DOMContentLoaded") {
  //     this.sendAsyncMessage("FindbarAI:ContentLoaded", {
  //       url: this.document.location.href,
  //       title: this.document.title,
  //     });
  //   }
  // }

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

      case "FindbarAI:HighlightAndScroll":
        return this.highlightAndScroll(message.data.text);

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
  
  injectHighlightStyle() {
    const styleId = "findbar-ai-highlight-style";
    if (this.document.getElementById(styleId)) return;

    const style = this.document.createElement("style");
    style.id = styleId;
    style.textContent = `
      mark.findbar-ai-highlight {
        background-color: yellow !important;
        color: black !important;
        outline: 1px solid orange !important;
      }
    `;
    this.document.head.appendChild(style);
  }

  clearHighlight() {
    if (this._currentHighlight && this._currentHighlight.parentNode) {
      const parent = this._currentHighlight.parentNode;
      parent.replaceChild(
        document.createTextNode(this._currentHighlight.textContent),
        this._currentHighlight,
      );
      parent.normalize();
      this._currentHighlight = null;
    }
  }

  highlightAndScroll(text) {
    this.injectHighlightStyle();
    this.clearHighlight();

    if (window.find(text, false, false, true, false, false, true)) {
      const selection = this.contentWindow.getSelection();
      if (!selection.rangeCount) return { success: false, error: "Text found but could not get selection range." };

      const range = selection.getRangeAt(0);
      const mark = this.document.createElement("mark");
      mark.className = "findbar-ai-highlight";
      
      try {
        range.surroundContents(mark);
        this._currentHighlight = mark;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => this.clearHighlight(), 3000);

        return { success: true };
      } catch (e) {
        debugError("Failed to wrap selection with <mark>:", e);
        return { success: false, error: "Could not highlight text." };
      }
    } else {
      return { success: false, error: "Text not found on page." };
    }
  }
}
