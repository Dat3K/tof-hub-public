// Unreal asset references are case-insensitive, and so is the Windows file system the
// pipeline runs on (fs.existsSync('A.webp') finds 'a.webp'); the Linux server is not.
// Spell a relative path exactly as it is stored under root, or null when it is absent.
const fs = require('node:fs');
const path = require('node:path');

function createDiskCase() {
  const listings = new Map();
  return function diskCase(root, relative) {
    let folder = root;
    const parts = [];
    for (const part of relative.split('/').filter(Boolean)) {
      if (!listings.has(folder)) {
        try { listings.set(folder, fs.readdirSync(folder)); } catch { listings.set(folder, []); }
      }
      const names = listings.get(folder);
      const lower = part.toLowerCase();
      const match = names.includes(part) ? part : names.find(name => name.toLowerCase() === lower);
      if (!match) return null;
      parts.push(match);
      folder = path.join(folder, match);
    }
    return parts.join('/');
  };
}

module.exports = {createDiskCase};
