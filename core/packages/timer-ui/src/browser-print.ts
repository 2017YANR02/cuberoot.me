/**
 * Browser print transport that keeps the shared snapshot alive until the
 * print UI closes. The timeout is only a safety net for engines that omit the
 * standard afterprint event.
 */
export function browserPrintTransport(_title?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('afterprint', finish);
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 30_000);
    window.addEventListener('afterprint', finish, { once: true });
    try {
      window.print();
    } catch (error) {
      window.removeEventListener('afterprint', finish);
      window.clearTimeout(fallback);
      settled = true;
      reject(error);
    }
  });
}
