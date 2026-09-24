#ifndef UTILS_DBG_LOG_H
#define UTILS_DBG_LOG_H

#include <stdio.h>

void (*nissy_log)(const char *, void *);
void *nissy_log_data;
void write_wrapper(void (*)(const char *, void *), const char *, ...);

void
write_wrapper(void (*write)(const char *, void *), const char *str, ...)
{
	char message[1000];
	va_list args;

	va_start(args, str);
	vsprintf(message, str, args);
	va_end(args);

	write(message, nissy_log_data);
}

#define LOG(...) if (nissy_log != NULL) write_wrapper(nissy_log, __VA_ARGS__);

#ifdef DEBUG
#define STATIC
#define STATIC_INLINE
#define DBG_WARN(condition, ...) if (!(condition)) LOG(__VA_ARGS__);
#define DBG_ASSERT(condition, ...) \
    if (!(condition)) { LOG(__VA_ARGS__); exit(1); }
#else
#define STATIC static
#define STATIC_INLINE static inline
#define DBG_WARN(condition, ...)
#define DBG_ASSERT(condition, ...)
#endif

#endif /* UTILS_DBG_LOG_H */
