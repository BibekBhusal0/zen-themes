import { windowManagerAPI } from "../windowManager.js";
import getPref from "../../utils/getPref.mjs";

const DEBUG_MODE = "extension.findbar-ai.debug-mode";
// Debug logging helper
const debugLog = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.log("FindbarAI [Gemini]:", ...args);
  }
};

const debugError = (...args) => {
  if (getPref(DEBUG_MODE, false)) {
    console.error("FindbarAI [Gemini]:", ...args);
  }
};

// --- Internal Helper for Search ---
async function getSearchURL(engineName, searchTerm) {
  try {
    const engine = await Services.search.getEngineByName(engineName);
    if (!engine) {
      debugError(`No search engine found with name: ${engineName}`);
      return null;
    }
    const submission = engine.getSubmission(searchTerm.trim());
    if (!submission) {
      debugError(
        `No submission found for term: ${searchTerm} and engine: ${engineName}`,
      );
      return null;
    }
    return submission.uri.spec;
  } catch (e) {
    debugError(`Error getting search URL for engine "${engineName}".`, e);
    return null;
  }
}

// --- Tool Implementations ---
async function openLink(args) {
  const { link, where = "new tab" } = args;
  if (!link) return { error: "openLink requires a link." };
  const whereNormalized = where?.toLowerCase()?.trim();
  try {
    switch (whereNormalized) {
      case "current tab":
        openTrustedLinkIn(link, "current");
        break;
      case "new tab":
        openTrustedLinkIn(link, "tab");
        break;
      case "new window":
        openTrustedLinkIn(link, "window");
        break;
      case "incognito":
      case "private":
        window.openTrustedLinkIn(link, "window", { private: true });
        break;
      case "glance":
        if (window.gZenGlanceManager) {
          const rect = gBrowser.selectedBrowser.getBoundingClientRect();
          window.gZenGlanceManager.openGlance({
            url: link,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: 10,
            height: 10,
          });
        } else {
          openTrustedLinkIn(link, "tab");
          return { result: `Glance not available. Opened in a new tab.` };
        }
        break;
      case "vsplit":
      case "hsplit":
        if (window.gZenViewSplitter) {
          const sep = whereNormalized === "vsplit" ? "vsep" : "hsep";
          const tab1 = gBrowser.selectedTab;
          await openTrustedLinkIn(link, "tab");
          const tab2 = gBrowser.selectedTab;
          gZenViewSplitter.splitTabs([tab1, tab2], sep, 1);
        } else return { error: "Split view is not available." };
        break;
      default:
        openTrustedLinkIn(link, "tab");
        return {
          result: `Unknown location "${where}". Opened in a new tab as fallback.`,
        };
    }
    return { result: `Successfully opened ${link} in ${where}.` };
  } catch (e) {
    debugError(`Failed to open link "${link}" in "${where}".`, e);
    return { error: `Failed to open link.` };
  }
}

async function search(args) {
  const { searchTerm, engineName, where } = args;
  const defaultEngineName = Services.search.defaultEngine.name;
  const searchEngineName = engineName || defaultEngineName;
  if (!searchTerm) return { error: "Search tool requires a searchTerm." };

  const url = await getSearchURL(searchEngineName, searchTerm);
  if (url) {
    return await openLink({ link: url, where });
  } else {
    return {
      error: `Could not find search engine named '${searchEngineName}'.`,
    };
  }
}

async function newSplit(args) {
  const { link1, link2, type = "vertical" } = args;
  if (!window.gZenViewSplitter)
    return { error: "Split view function is not available." };
  if (!link1 || !link2) return { error: "newSplit requires two links." };
  try {
    const sep = type.toLowerCase() === "vertical" ? "vsep" : "hsep";
    await openTrustedLinkIn(link1, "tab");
    const tab1 = gBrowser.selectedTab;
    await openTrustedLinkIn(link2, "tab");
    const tab2 = gBrowser.selectedTab;
    gZenViewSplitter.splitTabs([tab1, tab2], sep, 1);
    return {
      result: `Successfully created ${type} split view with the provided links.`,
    };
  } catch (e) {
    debugError("Failed to create split view.", e);
    return { error: "Failed to create split view." };
  }
}

// TODO:
// --- Tool for browser control ---
function compactMode() { }
function getBookmakrs() { }
function addBookmakrs() { }
function removeBookmarks() { }

const availableTools = {
  search,
  newSplit,
  openLink,
  getPageTextContent:
    windowManagerAPI.getPageTextContent.bind(windowManagerAPI),
  getHTMLContent: windowManagerAPI.getHTMLContent.bind(windowManagerAPI),
};

const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "search",
        description:
          "Performs a web search using a specified search engine and opens the results.",
        parameters: {
          type: "OBJECT",
          properties: {
            searchTerm: {
              type: "STRING",
              description: "The term to search for.",
            },
            engineName: {
              type: "STRING",
              description: "Optional. The name of the search engine to use.",
            },
            where: {
              type: "STRING",
              description:
                "Optional. Where to open the search results. Options: 'current tab', 'new tab', 'new window', 'incognito', 'glance', 'vsplit', 'hsplit'. Defaults to 'new tab'. Note that 'glance', 'vsplit' and 'hsplit' are special to zen browser. 'glance' opens in small popup and 'vsplit' and 'hsplit' opens in vertical and horizontal split respectively. When user says open in split and don't spicify 'vsplit' or 'hsplit' default to 'vsplit'.",
            },
          },
          required: ["searchTerm"],
        },
      },
      {
        name: "openLink",
        description:
          "Opens a given URL in a specified location. Can also create a split view with the current tab.",
        parameters: {
          type: "OBJECT",
          properties: {
            link: { type: "STRING", description: "The URL to open." },
            where: {
              type: "STRING",
              description:
                "Optional. Where to open the link. Options: 'current tab', 'new tab', 'new window', 'incognito', 'glance', 'vsplit', 'hsplit'. Defaults to 'new tab'. Note that 'glance', 'vsplit' and 'hsplit' are special to zen browser. 'glance' opens in small popup and 'vsplit' and 'hsplit' opens in vertical and horizontal split respectively. When user says open in split and don't spicify 'vsplit' or 'hsplit' default to 'vsplit'.",
            },
          },
          required: ["link"],
        },
      },
      {
        name: "newSplit",
        description:
          "Creates a split view by opening two new URLs in two new tabs, then arranging them side-by-side.",
        parameters: {
          type: "OBJECT",
          properties: {
            link1: {
              type: "STRING",
              description: "The URL for the first new tab.",
            },
            link2: {
              type: "STRING",
              description: "The URL for the second new tab.",
            },
            type: {
              type: "STRING",
              description:
                "Optional, The split type: 'horizontal' or 'vertical'. Defaults to 'vertical'.",
            },
          },
          required: ["link1", "link2"],
        },
      },
      {
        name: "getPageTextContent",
        description:
          "Retrieves the text content of the current web page to answer questions if the initial context is insufficient.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "getHTMLContent",
        description:
          "Retrieves the full HTML source of the current web page for detailed analysis. Use this tool very rarely, only when text content is insufficient.",
        parameters: { type: "OBJECT", properties: {} },
      },
    ],
  },
];

const getToolSystemPrompt = async () => {
  try {
    const searchEngines = await Services.search.getVisibleEngines();
    const engineNames = searchEngines.map((e) => e.name).join(", ");
    const defaultEngineName = Services.search.defaultEngine.name;
    return `
- When asked about your own abilities, describe the functions you can perform based on the tools listed below.

## GOD MODE ENABLED - TOOL USAGE:
You have access to browser functions. The user knows you have these abilities.
- **CRITICAL**: When you decide to call a tool, give short summary of what tool are you calling and why?
- Use tools when the user explicitly asks, or when it is the only logical way to fulfill their request (e.g., "search for...").

## Available Tools:
- \`search(searchTerm, engineName, where)\`: Performs a web search. Available engines: ${engineNames}. The default is '${defaultEngineName}'.
- \`openLink(link, where)\`: Opens a URL. Use this to open a single link or to create a split view with the *current* tab.
- \`newSplit(link1, link2, type)\`: Use this specifically for creating a split view with *two new tabs*.
- \`getPageTextContent()\` / \`getHTMLContent()\`: Use these to get updated page information if context is missing. Prefer \`getPageTextContent\`.

## More instructions for Running tools
- While running tool like \`openLink\` and \`newSplit\` make sure URL is valid.
- User will provide URL and title of current of webpage. If you need more context, use the \`getPageTextContent\` or \`getHTMLContent\` tools.
- When the user asks you to "read the current page", use the \`getPageTextContent()\` or \`getHTMLContent\` tool.
- If the user asks you to open a link by its text (e.g., "click the 'About Us' link"), you must first use \`getHTMLContent()\` to find the link's full URL, then use \`openLink()\` to open it.

## Tool Call Examples:
Therse are just examples for you on how you can use tools calls, each example give you some concept, the concept is not specific to single tool.

### Use default value when user don't provides full information, If user don't provide default value you may ask and even give options if possible
#### Searching the Web: 
-   **User Prompt:** "search for firefox themes"
-   **Your Tool Call:** \`{"functionCall": {"name": "search", "args": {"searchTerm": "firefox themes", "engineName": "${defaultEngineName}"}}}\`

### Make sure you are calling tools with correct parameters.
#### Opening a Single Link:
-   **User Prompt:** "open github"
-   **Your Tool Call:** \`{"functionCall": {"name": "openLink", "args": {"link": "https://github.com", "where": "new tab"}}}\`

#### Creating a Split View with Two New Pages:
-   **User Prompt:** "show me youtube and twitch side by side"
-   **Your Tool Call:** \`{"functionCall": {"name": "newSplit", "args": {"link1": "https://youtube.com", "link2": "https://twitch.tv"}}}\`

### Use tools to get more context: If user ask anything whose answer is unknown to you and it can be obtained via tool call use it.
#### Reading the Current Page for Context
-   **User Prompt:** "summarize this page for me"
-   **Your Tool Call:** \`{"functionCall": {"name": "getPageTextContent", "args": {}}}\`

### Taking multiple steps; you might need for previous tool to compete and give you output before calling next tool
#### Finding and Clicking a Link on the Current Page
-   **User Prompt:** "click on the contact link"
-   **Your First Tool Call:** \`{"functionCall": {"name": "getHTMLContent", "args": {}}}\`
-   **Your Second Tool Call (after receiving HTML and finding the link):** \`{"functionCall": {"name": "openLink", "args": {"link": "https://example.com/contact-us"}}}\`

### Calling multiple tools at once.
#### Making 2 searches in split 
-   **User Prompt:** "Search for Japan in google and search for America in Youtube. Open them in vertical split."
-   **Your First Tool Call:** \`{"functionCall": {"name": "search", "args": {"searchTerm": "Japan", "engineName": "Google", "where": "new tab"}}}\`
-   **Your Second Tool Call:** \`{"functionCall": {"name": "search", "args": {"searchTerm": "America", "engineName": "Youtube", "where": "vsplit"}}}\`

*(Available search engines: ${engineNames}. Default is '${defaultEngineName}'.)*
`;
  } catch (error) {
    debugError("Error in getToolSystemPrompt:", error);
    return "";
  }
};

export { availableTools, toolDeclarations, getToolSystemPrompt };
