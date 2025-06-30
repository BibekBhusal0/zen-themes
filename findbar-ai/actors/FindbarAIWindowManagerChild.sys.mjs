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
    if (this.browsingContext.top) {
      this.browsingContext.top.window.console.log(
        "[findbar-ai] windowManager.js (Child):",
        ...args,
      );
    }
  }

  debugError(...args) {
    if (this.browsingContext.top) {
      this.browsingContext.top.window.console.error(
        "[findbar-ai] windowManager.js (Child Error):",
        ...args,
      );
    }
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
    this.debugLog("extractTextContent called");
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
    this.debugLog("injectHighlightStyle called");
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
    this.debugLog("clearHighlight called");
    if (this._highlightTimer) {
      this.browsingContext.top.window.clearTimeout(this._highlightTimer);
      this._highlightTimer = null;
    }

    if (this._currentHighlight && this._currentHighlight.parentNode) {
      const parent = this._currentHighlight.parentNode;
      parent.replaceChild(
        this.document.createTextNode(this._currentHighlight.textContent),
        this._currentHighlight,
      );
      parent.normalize();
      this._currentHighlight = null;
    }
  }

  findRangeFromText(searchText) {
    const bodyText = this.document.body.innerText;

    const escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedText.replace(/\s+/g, "\\s+"));

    const match = bodyText.match(searchRegex);
    if (!match) {
      this.debugError("Regex search failed to find a match for:", searchText);
      return null;
    }

    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;

    this.debugLog(`Regex match found. Start: ${startIndex}, End: ${endIndex}`);

    const range = this.document.createRange();
    const walker = this.document.createTreeWalker(
      this.document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );

    let charCount = 0;
    let startNode, startOffset, endNode, endOffset;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLength = node.textContent.length;

      if (!startNode && startIndex < charCount + nodeLength) {
        startNode = node;
        startOffset = startIndex - charCount;
      }
      if (!endNode && endIndex <= charCount + nodeLength) {
        endNode = node;
        endOffset = endIndex - charCount;
        break;
      }
      charCount += nodeLength;
    }

    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }

    this.debugError("Failed to map character indices to DOM nodes.");
    return null;
  }

  highlightAndScroll(text) {
    this.debugLog("Highlight and scroll triggered with text:", `"${text}"`);
    this.injectHighlightStyle();
    this.clearHighlight();

    const range = this.findRangeFromText(text);

    if (range) {
      const mark = this.document.createElement("mark");
      mark.className = "findbar-ai-highlight";
      try {
        range.surroundContents(mark);
        this._currentHighlight = mark;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        this.debugLog("Highlight successful.");
        this._highlightTimer = this.browsingContext.top.window.setTimeout(
          () => this.clearHighlight(),
          3000,
        );

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
