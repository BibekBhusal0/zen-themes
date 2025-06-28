// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log("findbar: Window Manager child loaded");

export class FindbarAIWindowManagerChild extends JSWindowActorChild {
  constructor() {
    super();
  }

  handleEvent(event) {
    console.log(`findbar: child handling event: ${event.type}`);
    if (event.type === "DOMContentLoaded") {
      this.sendAsyncMessage("FindbarAI:ContentLoaded", {
        url: this.document.location.href,
        title: this.document.title,
      });
    }
  }

  async receiveMessage(message) {
    console.log(`findbar: child received message: ${message.name}`);
    switch (message.name) {
      case "FindbarAI:GetPageContent":
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

      default:
        console.log(`findbar: child unhandled message: ${message.name}`);
    }
  }
}
