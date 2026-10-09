# TO-DO list for API changes

When `nissy.h` is modified, for example because a new API function is added or
one of the old ones changes signature, all the examples and tools that include
this file must be adapted. Here is a list:

* Update the tools in `tools/`.
* Update the shell `shell/shell.c`.
* Update the python module `python/nissy_module.c` and, if needed, the
  examples in `python/examples/`.
* Update the C++ adapter `cpp/nissy.{cpp,h}` and, if needed, the examples in
  `cpp/examples/`.
* Update the web adapter `web/adapter.cpp` (based on the C++ header) and,
  if needed, the example webapp in `web/http/`.
