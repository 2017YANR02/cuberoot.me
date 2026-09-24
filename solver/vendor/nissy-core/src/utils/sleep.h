#ifndef UTILS_SLEEP_H
#define UTILS_SLEEP_H

#define BASE_SLEEP_TIME 500

STATIC void msleep(int);

#if defined(_WIN32)

#include <windows.h>

#define NISSY_CANSLEEP true

STATIC void
msleep(int milliseconds)
{
	Sleep(milliseconds);
}

#elif defined(__wasm__)

#include <emscripten.h>

#define NISSY_CANSLEEP true

STATIC void
msleep(int milliseconds)
{
	emscripten_sleep(milliseconds);
}

#elif defined(__unix__) || defined(__APPLE__)

#include <time.h>

#define NISSY_CANSLEEP true

STATIC void
msleep(int milliseconds)
{
	struct timespec t;
	t.tv_sec = milliseconds / 1000;
	t.tv_nsec = (milliseconds % 1000) * 1000000;
	nanosleep(&t, NULL);
}

#else

#define NISSY_CANSLEEP false
STATIC void
msleep(int milliseconds)
{
}

#endif

#endif /* UTILS_SLEEP_H */
