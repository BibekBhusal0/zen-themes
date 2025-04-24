/* /* // ==UserScript==
// @name            Sidebar Pin Unpin icon
// @description     Toggle pin unpin easily with a button
// @author          BibekBhusal
// ==/UserScript== */

import { XULElement } from "../zen-second-sidebar/src/second_sidebar/xul/base/xul_element.mjs";
import { Div } from "../zen-second-sidebar/src/second_sidebar/xul/base/div.mjs";
import { Img } from "../zen-second-sidebar/src/second_sidebar/xul/base/img.mjs";

const api_available = typeof UC_API !== "undefined";
function addButton() {
  if (!api_available) return;
  console.log("sidebar adding button");
  const header = new XULElement({
    element: document.getElementById("sidebar-header"),
  });

  if (!header) return;
  console.log("sidebar header found");
  const button = new Div({ id: "sidebar-pin-unpin" });
  const img = new Img();

  const config_flag = "natsumi.sidebar.ff-sidebar-float";
  const pref = UC_API.Prefs.get(config_flag);
  const render_button = () => {
    if (pref.value) {
      img.setSrc(
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin-icon lucide-pin"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
      );
    } else {
      img.setSrc(
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin-off-icon lucide-pin-off"><path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/></svg>',
      );
    }
  };

  render_button();
  const buttonClick = () => {
    pref.setTo(!pref.value);
    render_button();
  };
  UC_API.Prefs.addListener(config_flag, render_button);

  button.addEventListener("click", buttonClick);
  button.appendChild(img);
  const children = header.element.children;
  if (children.length > 1) {
    header.element.insertBefore(button.element, children[children.length - 1]);
  } else {
    header.appendChild(button);
  }
}

console.log("loaded ff-sidebar script");

if (api_available) {
  UC_API.Runtime.startupFinished().then(addButton);
}
