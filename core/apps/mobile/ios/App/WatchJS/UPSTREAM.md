# QuickJS core for the watch host

Unmodified core sources from https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz.
SHA-256: `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`.
License: MIT; original notice retained in every source and `vendor/LICENSE`.

Only the five upstream engine translation units are built. The POSIX CLI / libc
module is excluded because process execution is unavailable on watchOS. The small
`bridge.c` exposes evaluation to Swift with a 16 MiB heap and bounded execution;
it does not implement JavaScript, cube protocols, cryptography or timer rules.
The bundled source is produced from the existing app-ui/shared code at build time.
Credits are maintained in the project's canonical `/about` data.
