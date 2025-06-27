// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log("findbar:Window Manager child loaded");
export class FindbarWMChild extends JSWindowActorChild {
  constructor() {
    super();
  }

  handleEvent(event) {
    if (event.type === "DOMContentLoaded") {
      this.sendAsyncMessage(
        "content is lodaded now you can take control and change",
      );
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      default:
        console.log(`findbar: child unhandled message: ${message.name}`);
    }
  }
}

