// ==UserScript==
// @name           Custom Widget
// @description    Adds a custom widget to Firefox
// ==/UserScript==

const widgets = [
  {
    id: "custom-scripts-widget",
    type: "toolbarbutton",
    label: "Open Scipt",
    tooltip: "Open Scripts Directory",
    class: "toolbarbutton-1 chromeclass-toolbar-additional",
    image: "chrome://browser/skin/zen-icons/source-code.svg",
    callback: UC_API.Scripts.openScriptDir,
  },

  {
    id: "reopen-closed-tab",
    type: "toolbarbutton",
    label: "Reopen last closed tab",
    tooltip: "Reopen closed tab",
    class: "toolbarbutton-1 chromeclass-toolbar-additional",
    image: "chrome://browser/skin/zen-icons/edit-undo.svg",
    callback: function() {
      undoCloseTab();
    },
  },
];

widgets.forEach((widget) => {
  UC_API.Utils.createWidget(widget);
});
