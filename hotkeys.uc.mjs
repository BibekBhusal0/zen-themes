/* /* // ==UserScript==
// @name            Second Sidebar for Firefox
// @description     A Firefox userChrome.js script for adding a second sidebar with web panels like in Vivaldi/Floorp/Zen.
// @author          aminought
// @homepageURL     https://github.com/aminought/firefox-second-sidebar
// ==/UserScript== */
/*
const api_available = typeof UC_API !== "undefined";
console.log("hotkeys config loaded");
if (api_available) {
  console.log("hotkeys api available");

  // const keys = [
  //   {
  //     id: "custom_key_1",
  //     modifiers: "ctrl shift",
  //     key: "G",
  //     command: (window, commandEvent) =>
  //       console.log("Hello from " + window.document.title),
  //   },
  //   {
  //     id: "custom_key_2",
  //     modifiers: "ctrl alt shift",
  //     key: "r",
  //     command: () => UC_API.Runtime.restart(),
  //   },
  // ];

  // description for hotkey Ctrl + Shift + G
  let details = {
    id: "myHotkey",
    modifiers: "ctrl",
    key: "g",
    command: (window) => {
      console.log("Hello from " + window.document.title);
    },
  };

  let myKey = UC_API.Hotkeys.define(details);
  console.log("🌟 myKey:", myKey);
  console.log("🌟 myKey:", JSON.stringify(myKey, null, 2));
  console.log("done setting hotkey");
  // myKey will be a instance of Hotkey description object
  // keys.forEach((keyDetails) => {
  //   UC_API.Hotkeys.define(keyDetails);
  // });

  let new_var = {
    id: "myHotkey",
    modifiers: "ctrl",
    key: "T",
    command: (window, commandEvent) => {
      console.log("Hello from " + window.document.title);
    },
  };

  UC_API.Hotkeys.define(new_var).autoAttach({ suppressOriginal: true });
  // This defines the key `Ctrl+T`, attaches it to all current and future main browser windows and disables original newtab key.
} */
