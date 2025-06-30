export class FindbarAIWindowManagerChild extends JSWindowActorChild {
  constructor() {
    super();
    this._currentHighlight = null;
    this._highlightTimer = null;
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

  debugLog(...args) {
    this.browsingContext.top.window.console.log(
      "[findbar-ai] windowManager.js (Child):",
      ...args,
    );
  }

  debugError(...args) {
    this.browsingContext.top.window.console.error(
      "[findbar-ai] windowManager.js (Child Error):",
      ...args,
    );
  }

  async receiveMessage(message) {
    this.debugLog(`Received message: ${message.name}`);
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
        this.debugLog(`Unhandled message: ${message.name}`);
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

    this.debugLog("Injecting highlight style into the page.");
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
    if (this._highlightTimer) {
      this._highlightTimer.cancel();
      this._highlightTimer = null;
      this.debugLog("Cancelled pending highlight removal timer.");
    }

    if (this._currentHighlight && this._currentHighlight.parentNode) {
      this.debugLog("Clearing previous highlight.");
      const parent = this._currentHighlight.parentNode;
      parent.replaceChild(
        document.createTextNode(this._currentHighlight.textContent),
        this._currentHighlight,
      );
      parent.normalize();
      this._currentHighlight = null;
    } else {
      this.debugLog("No previous highlight to clear.");
    }
  }

  highlightAndScroll(text) {
    this.debugLog("Highlight and scroll triggered with text:", `"${text}"`);
    this.injectHighlightStyle();
    this.clearHighlight();

    // Reset the find operation to start from the top of the page
    this.browsingContext.top.window.getSelection().removeAllRanges();

    if (
      this.browsingContext.top.window.find(
        text,
        false,
        false,
        true,
        false,
        false,
        true,
      )
    ) {
      this.debugLog("Text found on page.");
      const selection = this.contentWindow.getSelection();
      if (!selection.rangeCount) {
        this.debugError("Text found but could not get selection range.");
        return {
          success: false,
          error: "Text found but could not get selection range.",
        };
      }

      const range = selection.getRangeAt(0);
      const mark = this.document.createElement("mark");
      mark.className = "findbar-ai-highlight";

      try {
        range.surroundContents(mark);
        this._currentHighlight = mark;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });

        this.debugLog(
          "Highlight successful. Setting timer to clear in 3 seconds.",
        );
        this.browsingContext.top.window.setTimeout(() => {
          this.debugLog("3 seconds complete removing highlights");
          this.clearHighlight();
        }, 3000);

        return { success: true };
      } catch (e) {
        this.debugError("Failed to wrap selection with <mark>:", e);
        return { success: false, error: "Could not highlight text." };
      }
    } else {
      this.debugError("Text not found on page.");
      return { success: false, error: "Text not found on page." };
    }
  }
}
