export async function browserClipboardTransport(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
  await navigator.clipboard.writeText(text);
}
