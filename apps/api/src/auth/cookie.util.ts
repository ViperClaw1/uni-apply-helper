export const SESSION_COOKIE_NAME = 'session';

export function parseCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }

  for (const part of header.split('; ')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    if (part.slice(0, separatorIndex) === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1));
    }
  }

  return undefined;
}
