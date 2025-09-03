import { isEmptyString } from "./string-helpers";

export function getParentPath(path: string): string | null {
  if (!path || typeof path !== "string") return null;

  const lastDotIndex = path.lastIndexOf(".");
  return lastDotIndex === -1 ? "" : path.substring(0, lastDotIndex);
}

export function getRelativePath(path: string, parentPath: string): string {
  if (isEmptyString(parentPath)) return path;

  return path.startsWith(parentPath + ".")
    ? path.substring(parentPath.length + 1)
    : path;
}

export function getPathSegments(
  path: string,
  start: number = 0,
  count: number = 1
): string {
  const segments = path.split(".");
  const taken = segments.slice(start, start + count);
  return taken.join(".");
}
