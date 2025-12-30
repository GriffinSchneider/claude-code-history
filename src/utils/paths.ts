import { homedir } from 'os';
import { join } from 'path';

const CLAUDE_DIR = join(homedir(), '.claude');
export const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

/**
 * Decode a project folder name back to the original path
 * Encoding: / -> -, /_ -> --, /. -> --
 * e.g., "-Users-griffinschneider-dev--expiriments" -> "/Users/griffinschneider/dev/_expiriments"
 */
export function decodeProjectPath(folderName: string): string {
  // Handle double-dash (represents /_ or /.)
  // We'll assume underscore since it's more common in code dirs
  // Replace -- with a placeholder, then - with /, then restore
  return (
    '/' +
    folderName
      .slice(1)
      .replace(/--/g, '/_')
      .replace(/-/g, '/')
  );
}

/**
 * Get a short display name for a project path
 * e.g., "/Users/griffinschneider/dev/core" -> "core"
 */
export function getProjectDisplayName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}
