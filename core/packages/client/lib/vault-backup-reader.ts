// The search runs within the saved document. Its contents are readable without JavaScript.
export const vaultBackupReaderScript = `
const search = document.getElementById('search');
document.getElementById('search-controls').hidden = false;
const items = Array.from(document.querySelectorAll('#items > details'), row => ({
  row, terms: row.textContent.toLocaleLowerCase(),
}));
const empty = document.getElementById('empty');
search.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase();
  let found = false;
  for (const { row, terms } of items) {
    row.hidden = !terms.includes(query);
    found ||= !row.hidden;
  }
  empty.hidden = found;
});
`;

export const vaultBackupReaderStyle = `
html { color-scheme: light dark; font: 100%/1.5 system-ui, sans-serif; }
body { width: min(48rem, calc(100% - 2rem)); margin: 2rem auto; overflow-wrap: anywhere; }
input { max-width: 100%; font: inherit; padding: .35rem .55rem; }
label { display: block; }
details { margin: 1rem 0; }
summary { cursor: pointer; font-weight: 600; }
details > div { padding-inline-start: 1rem; }
.backup-account, .backup-information {
  margin-block: .75rem;
  padding: .75rem;
  border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas);
  border-radius: .75rem;
}
.backup-account h3, .backup-information h3 { margin: 0 0 .5rem; }
.backup-account dl { margin: 0; }
.backup-account dd:last-child { margin-bottom: 0; }
dt { font-weight: 600; }
dd { margin: 0 0 .65rem; white-space: pre-wrap; }
.backup-field-value { white-space: pre-wrap; }
img { display: block; max-width: 100%; max-height: 28rem; object-fit: contain; margin-block: .35rem 1rem; }
`;
