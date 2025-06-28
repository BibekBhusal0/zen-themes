// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log("findbar: Window Manager parent loaded");

export class FindbarAIWindowManagerParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    console.log("findbar: parent received message");
    console.log(`Message name: ${message.name}`);
    console.log("Message data:", message.data);

    switch (message.name) {
      case "FindbarAI:ContentLoaded":
        console.log(`Page loaded: ${message.data.title} - ${message.data.url}`);
        break;

      default:
        console.log(`findbar: parent unhandled message: ${message.name}`);
    }
  }

  // Helper method to get page content
  async getPageContent() {
    try {
      const result = await this.sendQuery("FindbarAI:GetPageContent");
      return result;
    } catch (e) {
      console.error("Failed to get page content:", e);
      return null;
    }
  }

  // Helper method to get selected text
  async getSelectedText() {
    try {
      const result = await this.sendQuery("FindbarAI:GetSelectedText");
      return result;
    } catch (e) {
      console.error("Failed to get selected text:", e);
      return null;
    }
  }
}
