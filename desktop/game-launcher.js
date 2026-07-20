const { spawn } = require('child_process');
const { shell } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Launch a game via URI protocol or local exe path.
 */
async function launchGame(gamePath) {
  if (!gamePath) {
    return { success: false, error: '未提供遊戲路徑' };
  }

  try {
    // Platform URI (steam://, epic://, com.epicgames.launcher://, battlenet://, etc.)
    if (gamePath.includes('://')) {
      await shell.openExternal(gamePath);
      return { success: true };
    }

    // Local file - verify it exists first
    if (!fs.existsSync(gamePath)) {
      return { success: false, error: `找不到檔案: ${gamePath}` };
    }

    // Try to spawn as a detached process (best for exe files)
    try {
      const cwd = path.dirname(gamePath);
      const child = spawn(gamePath, [], {
        detached: true,
        stdio: 'ignore',
        cwd,
        shell: false,
      });
      child.on('error', () => {});
      child.unref();
      return { success: true };
    } catch (spawnErr) {
      // Fallback: use OS default handler
      const result = await shell.openPath(gamePath);
      if (result) {
        return { success: false, error: result };
      }
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = { launchGame };
