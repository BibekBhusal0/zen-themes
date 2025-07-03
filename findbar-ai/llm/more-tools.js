// ────────────────── more function which llms can use ───────────────

// ╭─────────────────────────────────────────────────────────╮
// │                        BOOKMARKS                        │
// ╰─────────────────────────────────────────────────────────╯

/**
 * Searches bookmarks based on a query.
 * @param {object} args - The arguments object.
 * @param {string} args.query - The search term for bookmarks.
 * @returns {Promise<object>} A promise that resolves with an object containing an array of bookmark results or an error.
 */
async function searchBookmarks(args) {
  const { query } = args;
  if (!query) return { error: "searchBookmarks requires a query." };

  try {
    const searchParams = { query };
    const bookmarks = await PlacesUtils.bookmarks.search(searchParams);

    // Map to a simpler format to save tokens for the AI model
    const results = bookmarks.map((bookmark) => ({
      id: bookmark.guid,
      title: bookmark.title,
      url: bookmark.url.href,
      parentID: bookmark.parentGuid,
    }));

    debugLog(
      `Found ${results.length} bookmarks for query "${query}":`,
      results,
    );
    return { bookmarks: results };
  } catch (e) {
    debugError(`Error searching bookmarks for query "${query}":`, e);
    return { error: `Failed to search bookmarks.` };
  }
}

/**
 * Reads all bookmarks.
 * @returns {Promise<object>} A promise that resolves with an object containing an array of all bookmark results or an error.
 */

async function getAllBookmarks() {
  try {
    const bookmarks = await PlacesUtils.bookmarks.search({});

    const results = bookmarks.map((bookmark) => ({
      id: bookmark.guid,
      title: bookmark.title,
      url: bookmark.url.href,
    }));

    debugLog(`Read ${results.length} total bookmarks.`);
    return { bookmarks: results };
  } catch (e) {
    debugError(`Error reading all bookmarks:`, e);
    return { error: `Failed to read all bookmarks.` };
  }
}

/**
 * Creates a new bookmark.
 * @param {object} args - The arguments object.
 * @param {string} args.url - The URL to bookmark.
 * @param {string} [args.title] - The title for the bookmark. If not provided, the URL is used.
 * @param {string} [args.parentId] - The GUID of the parent folder. Defaults to the "Other Bookmarks" folder.
 * @returns {Promise<object>} A promise that resolves with a success message or an error.
 */
async function createBookmark(args) {
  const { url, title, parentId } = args;
  if (!url) return { error: "createBookmark requires a URL." };

  try {
    const bookmarkInfo = {
      parentGuid: parentId || PlacesUtils.bookmarks.unfiledGuid,
      url: new URL(url),
      title: title || url,
    };

    const bm = await PlacesUtils.bookmarks.insert(bookmarkInfo);

    debugLog(`Bookmark created successfully:`, JSON.stringify(bm));
    return { result: `Successfully bookmarked "${bm.title}".` };
  } catch (e) {
    debugError(`Error creating bookmark for URL "${url}":`, e);
    return { error: `Failed to create bookmark.` };
  }
}

/**
 * Creates a new bookmark folder.
 * @param {object} args - The arguments object.
 * @param {string} args.title - The title for the new folder.
 * @param {string} [args.parentId] - The GUID of the parent folder. Defaults to the "Other Bookmarks" folder.
 * @returns {Promise<object>} A promise that resolves with a success message or an error.
 */
async function addBookmarkFolder(args) {
  const { title, parentId } = args;
  if (!title) return { error: "addBookmarkFolder requires a title." };

  try {
    const folderInfo = {
      parentGuid: parentId || PlacesUtils.bookmarks.unfiledGuid,
      type: PlacesUtils.bookmarks.TYPE_FOLDER,
      title: title,
    };

    const folder = await PlacesUtils.bookmarks.insert(folderInfo);

    debugLog(
      `Bookmark folder created successfully:`,
      JSON.stringify(folderInfo),
    );
    return { result: `Successfully created folder "${folder.title}".` };
  } catch (e) {
    debugError(`Error creating bookmark folder "${title}":`, e);
    return { error: `Failed to create folder.` };
  }
}

/**
 * Updates an existing bookmark.
 * @param {object} args - The arguments object.
 * @param {string} args.id - The GUID of the bookmark to update.
 * @param {string} [args.url] - The new URL for the bookmark.
 *
 * @param {string} [args.title] - The new title for the bookmark.
 * @returns {Promise<object>} A promise that resolves with a success message or an error.
 */
async function updateBookmark(args) {
  const { id, url, title, parentGuid } = args;
  if (!id) return { error: "updateBookmark requires a bookmark id (guid)." };
  if (!url && !title)
    return {
      error: "updateBookmark requires either a new url or a new title.",
    };

  try {
    const oldBookmark = await PlacesUtils.bookmarks.fetch(id);
    if (!oldBookmark) {
      return { error: `No bookmark found with id "${id}".` };
    }

    const bm = await PlacesUtils.bookmarks.update({
      guid: id,
      url: url ? new URL(url) : oldBookmark.url,
      title: title || oldBookmark.title,
      parentGuid: parentGuid || oldBookmark.parentGuid,
    });

    debugLog(`Bookmark updated successfully:`, JSON.stringify(bm));
    return { result: `Successfully updated bookmark to "${bm.title}".` };
  } catch (e) {
    debugError(`Error updating bookmark with id "${id}":`, e);
    return { error: `Failed to update bookmark.` };
  }
}

/**
 * Deletes a bookmark.
 * @param {object} args - The arguments object.
 * @param {string} args.id - The GUID of the bookmark to delete.
 * @returns {Promise<object>} A promise that resolves with a success message or an error.
 */

async function deleteBookmark(args) {
  const { id } = args;
  if (!id) return { error: "deleteBookmark requires a bookmark id (guid)." };
  try {
    await PlacesUtils.bookmarks.remove(id);
    debugLog(`Bookmark with id "${id}" deleted successfully.`);
    return { result: `Successfully deleted bookmark.` };
  } catch (e) {
    debugError(`Error deleting bookmark with id "${id}":`, e);
    return { error: `Failed to delete bookmark.` };
  }
}
