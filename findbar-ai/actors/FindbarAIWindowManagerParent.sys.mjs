// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

console.log("findbar:Window Manager parent loaded");
export class FindbarWMParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    console.log("findbar: parent received message");
    console.log(message.name);
    switch (message.name) {
      default:
        console.log(`findbar: parent unhandled message: ${message.name}`);
    }
  }
}

