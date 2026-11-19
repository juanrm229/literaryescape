/** A red string glows when it ties two documents the case author meant to be read together. */
export function glowing(links: [string, string][] | undefined, pins: { id: string; code: string }[], key: string) {
  if (!links?.length) return false;
  const [a, b] = key.split('|').map((id) => pins.find((q) => q.id === id)?.code);
  return !!a && !!b && a !== b && links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}
