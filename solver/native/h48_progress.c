#define _POSIX_C_SOURCE 200809L
#include "h48_progress.h"

#include <inttypes.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <pthread.h>
#include <unistd.h>
#endif

static atomic_int stage_value;
static atomic_int failed_from_stage;
static atomic_uint_fast64_t done_value, total_value;
static atomic_uint detail_value;
static atomic_int stop_value;
static atomic_uint_fast64_t stage_started_ms;
static uint64_t run_started_ms;
static char *progress_path;
static char *write_path;
static int monitor_started;
#ifdef _WIN32
static HANDLE monitor_thread;
static CRITICAL_SECTION emit_lock;
#else
static pthread_t monitor_thread;
static pthread_mutex_t emit_lock = PTHREAD_MUTEX_INITIALIZER;
#endif

static const char *const names[] = {
    "preparing file", "cocsep search", "clearing main table",
    "enumerating short states", "processing short states",
    "counting main table", "building eoesep", "validating table",
    "flushing to disk", "complete", "failed"
};
static const char *const labels[] = {
    "准备文件", "生成 cocsep", "初始化主表", "枚举短状态",
    "处理短状态", "统计主表", "生成 eoesep", "校验表",
    "刷盘落盘", "已完成", "失败"
};

static uint64_t now_ms(void) {
#ifdef _WIN32
    return GetTickCount64();
#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000 + (uint64_t)ts.tv_nsec / 1000000;
#endif
}

static void lock_emit(void) {
#ifdef _WIN32
    EnterCriticalSection(&emit_lock);
#else
    pthread_mutex_lock(&emit_lock);
#endif
}

static void unlock_emit(void) {
#ifdef _WIN32
    LeaveCriticalSection(&emit_lock);
#else
    pthread_mutex_unlock(&emit_lock);
#endif
}

static void format_duration(uint64_t seconds, char out[32]) {
    snprintf(out, 32, "%" PRIu64 "d %02" PRIu64 ":%02" PRIu64 ":%02" PRIu64,
             seconds / 86400, seconds / 3600 % 24, seconds / 60 % 60, seconds % 60);
}

static void emit_progress(void) {
    if (progress_path == NULL) return;
    lock_emit();
    int stage = atomic_load(&stage_value);
    int prior_stage = atomic_load(&failed_from_stage);
    uint64_t done = atomic_load(&done_value);
    uint64_t total = atomic_load(&total_value);
    uint32_t detail = atomic_load(&detail_value);
    uint64_t now = now_ms();
    uint64_t elapsed = (now - run_started_ms) / 1000;
    uint64_t stage_elapsed = (now - atomic_load(&stage_started_ms)) / 1000;
    int linear = stage == H48_CLEAR || stage == H48_SHORT_PROCESS ||
                 stage == H48_DISTRIBUTION || stage == H48_VALIDATE ||
                 stage == H48_FLUSH;
    double percent = total > 0 ? 100.0 * (double)done / (double)total : 0.0;
    if (total > 0 && done < total && percent > 99.999) percent = 99.999;
    double eta = -1;
    if (linear && total > 0 && done > 0 && done < total && stage_elapsed >= 30) {
        eta = (double)stage_elapsed * (double)(total - done) / (double)done;
    }
    if (total > 0 && done < total && total - done <= 1) eta = -1;
    time_t wall = time(NULL);
    struct tm utc;
    char updated[32];
#ifdef _WIN32
    gmtime_s(&utc, &wall);
#else
    gmtime_r(&wall, &utc);
#endif
    strftime(updated, sizeof(updated), "%Y-%m-%dT%H:%M:%SZ", &utc);

    FILE *file = fopen(write_path, "w");
    if (file == NULL) {
        fprintf(stderr, "\n[H48] cannot write progress file: %s\n", write_path);
        exit(1);
    }
    {
        fprintf(file,
                "{\"status\":\"%s\",\"stage\":\"%s\",\"stageIndex\":%d,\"stagesTotal\":9,\"done\":%" PRIu64
                ",\"total\":", stage == H48_COMPLETE ? "complete" :
                stage == H48_FAILED ? "failed" : "running", names[stage],
                stage >= H48_COMPLETE ? 9 : stage + 1, done);
        if (total > 0) fprintf(file, "%" PRIu64, total);
        else fputs("null", file);
        fprintf(file, ",\"failedFromStage\":");
        if (stage == H48_FAILED && prior_stage >= H48_PREPARE && prior_stage < H48_COMPLETE)
            fprintf(file, "\"%s\"", names[prior_stage]);
        else fputs("null", file);
        fprintf(file, ",\"detail\":%u,\"percent\":", detail);
        if (total > 0) fprintf(file, "%.3f", percent);
        else fputs("null", file);
        fprintf(file, ",\"elapsedSeconds\":%" PRIu64
                ",\"stageElapsedSeconds\":%" PRIu64 ",\"etaSeconds\":",
                elapsed, stage_elapsed);
        if (eta >= 0) fprintf(file, "%.0f", eta);
        else fputs("null", file);
        fprintf(file, ",\"etaScope\":\"stage\",\"updatedAt\":\"%s\"}\n", updated);
        if (fclose(file) == 0) {
#ifdef _WIN32
            if (!MoveFileExA(write_path, progress_path, MOVEFILE_REPLACE_EXISTING)) {
                fprintf(stderr, "\n[H48] cannot publish progress file: %s\n", progress_path);
                exit(1);
            }
#else
            if (rename(write_path, progress_path) != 0) {
                fprintf(stderr, "\n[H48] cannot publish progress file: %s\n", progress_path);
                exit(1);
            }
#endif
        } else {
            fprintf(stderr, "\n[H48] cannot finish progress file: %s\n", write_path);
            exit(1);
        }
    }

    char elapsed_text[32], eta_text[32];
    format_duration(elapsed, elapsed_text);
    if (eta >= 0) format_duration((uint64_t)eta, eta_text);
    fprintf(stderr, "\r\033[2K[H48 %d/9] %s", stage >= H48_COMPLETE ? 9 : stage + 1,
            stage == H48_FLUSH && detail == 1 ? "同步落盘" : labels[stage]);
    if (total > 0) fprintf(stderr, " %6.2f%% (%" PRIu64 "/%" PRIu64 ")",
                           done < total && percent > 99.99 ? 99.99 : percent, done, total);
    else if (stage == H48_COCSEP || stage == H48_SHORT_ENUM || stage == H48_EOESEP)
        fprintf(stderr, " depth=%u discovered=%" PRIu64, detail, done);
    if (total > 0 && stage == H48_EOESEP) fprintf(stderr, " depth=%u", detail);
    fprintf(stderr, " | 已运行 %s", elapsed_text);
    if (stage < H48_COMPLETE)
        fprintf(stderr, " | 本阶段剩余 %s%s", eta >= 0 ? "约 " : "估算中",
                eta >= 0 ? eta_text : "");
    fprintf(stderr, " | %s", updated);
    if (stage == H48_COMPLETE || stage == H48_FAILED) fputc('\n', stderr);
    fflush(stderr);
    unlock_emit();
}

#ifdef _WIN32
static DWORD WINAPI monitor(void *unused) {
#else
static void *monitor(void *unused) {
#endif
    (void)unused;
    while (!atomic_load(&stop_value)) {
        emit_progress();
#ifdef _WIN32
        Sleep(10000);
#else
        for (int i = 0; i < 100 && !atomic_load(&stop_value); i++) {
            const struct timespec pause = { .tv_sec = 0, .tv_nsec = 100000000 };
            nanosleep(&pause, NULL);
        }
#endif
    }
#ifdef _WIN32
    return 0;
#else
    return NULL;
#endif
}

void cuberoot_h48_progress_start(const char *table_path) {
    size_t size = strlen(table_path) + sizeof(".progress.json");
    progress_path = malloc(size);
    write_path = malloc(size + sizeof(".new"));
    if (progress_path == NULL || write_path == NULL) {
        fprintf(stderr, "[H48] cannot allocate progress paths\n");
        exit(1);
    }
    snprintf(progress_path, size, "%s.progress.json", table_path);
    snprintf(write_path, size + sizeof(".new"), "%s.new", progress_path);
    run_started_ms = now_ms();
    atomic_store(&stage_started_ms, run_started_ms);
    atomic_store(&stage_value, H48_PREPARE);
    atomic_store(&failed_from_stage, -1);
    atomic_store(&stop_value, 0);
#ifdef _WIN32
    InitializeCriticalSection(&emit_lock);
    monitor_thread = CreateThread(NULL, 0, monitor, NULL, 0, NULL);
    if (monitor_thread == NULL) {
        fprintf(stderr, "[H48] cannot start progress heartbeat\n");
        exit(1);
    }
#else
    if (pthread_create(&monitor_thread, NULL, monitor, NULL) != 0) {
        fprintf(stderr, "[H48] cannot start progress heartbeat\n");
        exit(1);
    }
#endif
    monitor_started = 1;
    emit_progress();
    fprintf(stderr, "\n[H48] progress file: %s\n", progress_path);
}

void cuberoot_h48_progress_stage(enum cuberoot_h48_stage stage,
                                 uint64_t done, uint64_t total, uint32_t detail) {
    atomic_store(&done_value, done);
    atomic_store(&total_value, total);
    atomic_store(&detail_value, detail);
    atomic_store(&stage_started_ms, now_ms());
    atomic_store(&stage_value, stage);
    emit_progress();
}

void cuberoot_h48_progress_done(uint64_t done) { atomic_store(&done_value, done); }
void cuberoot_h48_progress_add(uint64_t increment) { atomic_fetch_add(&done_value, increment); }
void cuberoot_h48_progress_distribution(uint64_t lines) {
    int stage = atomic_load(&stage_value);
    cuberoot_h48_progress_stage(stage == H48_VALIDATE ? H48_VALIDATE : H48_DISTRIBUTION,
                                0, lines, 0);
}

void cuberoot_h48_progress_finish(int success) {
    if (!monitor_started) return;
    if (!success) atomic_store(&failed_from_stage, atomic_load(&stage_value));
    atomic_store(&stop_value, 1);
#ifdef _WIN32
    WaitForSingleObject(monitor_thread, INFINITE);
    CloseHandle(monitor_thread);
#else
    pthread_join(monitor_thread, NULL);
#endif
    cuberoot_h48_progress_stage(success ? H48_COMPLETE : H48_FAILED, 0, 0, 0);
}
