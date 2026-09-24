#ifndef UTILS_PREFETCH_H
#define UTILS_PREFETCH_H

#if defined(__GNUC__) || defined(__clang__)
    #define prefetch(a, i) __builtin_prefetch(a+i, 0, 0)
#elif defined(AVX2)
    #define prefetch(a, i) _mm_prefetch((char *)(a+i), _MM_HINT_T0)
#else
    #define prefetch(a, i) (void)i
#endif

#endif /* UTILS_PREFETCH_H */
