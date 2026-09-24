#ifndef UTILS_COMPILERS_H
#define UTILS_COMPILERS_H

#if defined(__GNUC__)

#define UNUSED __attribute__((unused))
#define SIZE(x) static (x)
#define NON_NULL SIZE(1)

#elif defined(__clang__)

#define UNUSED __attribute__((unused))
#define SIZE(x) static (x)
#define NON_NULL SIZE(1)

#else

/*
For example MSVC, which is not fully C11 compliant (e.g. it does not support
a[static N] notation for array parameters).
*/

#define UNUSED
#define SIZE(x)
#define NON_NULL

#endif

#endif /* UTILS_COMPILERS_H */
