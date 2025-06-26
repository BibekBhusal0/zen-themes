// ==UserScript==
// @name            Sidebar Pin Unpin icon
// @description     Toggle pin unpin easily with a button
// @author          BibekBhusal
// ==/UserScript==

console.log("floating-sidebar.js loaded ")
const api_available = typeof UC_API !== "undefined";
function addButton() {
  if (!api_available) return;
  console.log("sidebar adding button");
  const header = document.getElementById("sidebar-header");

  if (!header) return;
  console.log("sidebar header found");
  const button = UC_API.Utils.createElement(document, "div", {
    id: "sidebar-pin-unpin",
  });
  const config_flag = "natsumi.sidebar.ff-sidebar-float";
  const pref = UC_API.Prefs.get(config_flag);
  const render_button = () => {
    button.className = pref.value ? "pinned" : "unpinned";
  };

  render_button();
  const buttonClick = () => {
    pref.setTo(!pref.value);
    render_button();
  };
  UC_API.Prefs.addListener(config_flag, render_button);

  button.addEventListener("click", buttonClick);
  const children = header.children;
  if (children.length > 1) {
    header.insertBefore(button, children[children.length - 1]);
  } else {
    header.appendChild(button);
  }
  render_button();
}

console.log("loaded ff-sidebar script");

if (api_available) {
  UC_API.Runtime.startupFinished().then(addButton);
}
