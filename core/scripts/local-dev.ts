// Compatibility for existing host registrations; the implementation explicitly uses ESM.
void import('./local-dev.mts').then(({ main }) => main()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
