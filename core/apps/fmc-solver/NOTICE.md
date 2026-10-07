# Vendored: cubelib (FMC solver)

`cubelib/` is a vendored copy of the FMC (Fewest Moves) solver from
[Jobarion/cubelib](https://github.com/Jobarion/cubelib) (the engine behind
https://joba.me/mallard). Used with the author's permission.

`cubelib-server/` is our thin HTTP front (tiny_http) over cubelib's solver:
generates the pruning tables once at startup, then serves
`GET /solve?scramble=…&steps=…&count=…` returning mallard-format JSON.

Build (nightly + avx2, set via this workspace's rust-toolchain.toml + .cargo/config.toml):
  cargo build --release -p cubelib-server

Dependencies are resolved by the workspace-root `Cargo.lock`, including when
Cargo is invoked from either member directory. The retained member-level
`cubelib/Cargo.lock` and `cubelib-server/Cargo.lock` are mirrors of that file
for repository dependency scanners; refresh both after changing the root lock.
