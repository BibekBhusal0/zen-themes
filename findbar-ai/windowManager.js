// https://github.com/CosmoCreeper/Sine/blob/main/engine/injectAPI.js
// ===========================================================
// Module to read HTML content (and maybe modify if I implement it)
// ===========================================================
const _actors = new Set();
let _lazy = {};
ChromeUtils.defineESModuleGetters(_lazy, {
  ActorManagerParent: "resource://gre/modules/ActorManagerParent.sys.mjs",
});

const windowManagerName = "FindbarAIWindowManager";

const windowManagerAPI = () => {
  if (_actors.has(windowManagerName)) {
    return;
  }

  const decl = {};
  decl[windowManagerName] = {
    parent: {
      esModuleURI:
        "chrome://userscripts/content/custom/findbar-ai/actors/FindbarAIWindowManagerParent.sys.mjs",
    },
    child: {
      esModuleURI:
        "chrome://userscripts/content/custom/findbar-ai/actors/FindbarAIWindowManagerChild.sys.mjs",
      events: {
        DOMContentLoaded: {},
      },
    },
    matches: ["https://*", "http://*"],
  };
  // allFrames: true,

  try {
    _lazy.ActorManagerParent.addJSWindowActors(decl);
    _actors.add(windowManagerName);
    console.log("FindbarAI WindowManager registered successfully");
  } catch (e) {
    console.warn(`Failed to register JSWindowActor: ${e}`);
  }
};

export default windowManagerAPI;
