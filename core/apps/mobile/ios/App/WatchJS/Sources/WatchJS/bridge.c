#include "WatchJS.h"
#include "quickjs.h"
#include <stdlib.h>
#include <string.h>
#include <time.h>
struct CWEngine { JSRuntime *runtime; JSContext *context; double deadline; double cpu_seconds; double evaluation_started; double budget; int incremental_jobs; };
// Limit actual script CPU work. watchOS may suspend this thread between two
// interrupt checks; time spent suspended must not exhaust the execution budget.
// Solve timestamps still come from the host's ContinuousClock, independently.
static double now(void) {
    struct timespec t;
    if (clock_gettime(CLOCK_THREAD_CPUTIME_ID, &t) != 0) return -1;
    return t.tv_sec + t.tv_nsec / 1e9;
}
static int interrupted(JSRuntime *runtime, void *opaque) {
    double current = now();
    return current < 0 || current > ((CWEngine *)opaque)->deadline;
}
// Shared asynchronous deadlines must not count time watchOS suspended the app.
// Accumulate each evaluation's thread CPU time; the serial queue can migrate
// between threads, so never compare thread clock values across evaluations.
static JSValue cpu_time(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    CWEngine *e = JS_GetContextOpaque(ctx);
    double current = now();
    return JS_NewFloat64(ctx, 1000 * (e->cpu_seconds + (current > e->evaluation_started ? current - e->evaluation_started : 0)));
}
static JSValue random_uint32(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return JS_NewFloat64(ctx, (double)arc4random());
}
static CWEngine *create(size_t memory_limit) {
    double started = now(); if (started < 0) return NULL;
    CWEngine *e = calloc(1, sizeof(*e)); if (!e) return NULL;
    e->runtime = JS_NewRuntime(); if (!e->runtime) { free(e); return NULL; }
    JS_SetMemoryLimit(e->runtime, memory_limit);
    JS_SetMaxStackSize(e->runtime, 512 * 1024);
    JS_SetInterruptHandler(e->runtime, interrupted, e);
    e->budget = 2; e->deadline = started + e->budget;
    e->context = JS_NewContext(e->runtime);
    if (!e->context) { JS_FreeRuntime(e->runtime); free(e); return NULL; }
    e->evaluation_started = started;
    JS_SetContextOpaque(e->context, e);
    JSValue global = JS_GetGlobalObject(e->context);
    JS_SetPropertyStr(e->context, global, "__watchCpuTime", JS_NewCFunction(e->context, cpu_time, "__watchCpuTime", 0));
    JS_FreeValue(e->context, global);
    return e;
}
CWEngine *cw_create(void) { return create(16 * 1024 * 1024); }
// Independent renderer/reconstruction runtime includes cubing.js and offline
// case tables. BLE/timing retains its smaller, separate 16 MiB limit.
CWEngine *cw_create_scene(void) { CWEngine *e = create(32 * 1024 * 1024); if (e) e->incremental_jobs = 1; return e; }
// Independent bounded random-state search; BLE/scene budgets remain unchanged.
CWEngine *cw_create_scramble(void) {
    CWEngine *e = create(32 * 1024 * 1024);
    if (e) {
        e->budget = 30; e->incremental_jobs = 1;
        JSValue global = JS_GetGlobalObject(e->context);
        JS_SetPropertyStr(e->context, global, "__watchRandomUInt32", JS_NewCFunction(e->context, random_uint32, "__watchRandomUInt32", 0));
        JS_FreeValue(e->context, global);
    }
    return e;
}
void cw_destroy(CWEngine *e) { if (e) { JS_FreeContext(e->context); JS_FreeRuntime(e->runtime); free(e); } }
char *cw_eval(CWEngine *e, const char *source, int *failed) {
    double started = now();
    if (started < 0) { *failed = 1; return strdup("Could not read script CPU clock"); }
    *failed = 0; e->deadline = started + e->budget; e->evaluation_started = started;
    // Serial render queues may resume on another OS thread between evaluations.
    JS_UpdateStackTop(e->runtime);
    JSValue result = JS_Eval(e->context, source, strlen(source), "WatchCube", JS_EVAL_TYPE_GLOBAL);
    JSContext *ctx = e->context;
    if (JS_IsException(result)) { *failed = 1; result = JS_GetException(ctx); }
    for (int i = 0; !*failed && i < (e->incremental_jobs ? 64 : 1024) && JS_IsJobPending(e->runtime); i++) {
        if (JS_ExecutePendingJob(e->runtime, &ctx) < 0) {
            JS_FreeValue(e->context, result); result = JS_GetException(ctx); *failed = 1;
        }
    }
    // Analysis resumes pending jobs on the next scene tick; the timer requires
    // a fully drained dispatch and retains its original rejection boundary.
    if (!*failed && !e->incremental_jobs && JS_IsJobPending(e->runtime)) {
        JS_FreeValue(ctx, result); result = JS_NewString(ctx, "Pending job budget exceeded"); *failed = 1;
    }
    const char *text = JS_ToCString(ctx, result);
    char *copy = strdup(text ? text : "Could not convert engine result");
    if (!text) *failed = 1;
    if (text) JS_FreeCString(ctx, text);
    JS_FreeValue(ctx, result);
    double finished = now();
    if (finished > started) e->cpu_seconds += finished - started;
    return copy;
}
void cw_free(char *value) { free(value); }
