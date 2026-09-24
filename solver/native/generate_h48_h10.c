/* Native H48 table worker. Run only through table_generator.
 * nissy-core is vendored at ../vendor/nissy-core (GPL-3.0-or-later;
 * see VENDOR.md for the macOS pthread selection patch).
 */
#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

#include "nissy.h"
#include "h48_progress.h"
#if defined(CUBEROOT_H48_BENCH_HASH) && defined(__APPLE__)
#include <CommonCrypto/CommonDigest.h>
#endif

#if !defined(_WIN32)
#if defined(MAP_ANONYMOUS)
#define CUBEROOT_MAP_ANON MAP_ANONYMOUS
#elif defined(MAP_ANON)
#define CUBEROOT_MAP_ANON MAP_ANON
#else
#error "Anonymous mmap is required for H48 generation"
#endif
#endif

static void log_nissy(const char *message, void *unused) {
    (void)unused;
    fputs(message, stderr);
}

int main(int argc, char **argv) {
    if (argc != 2 && argc != 3) {
        fprintf(stderr, "usage: generate_h48_h10 OUTPUT_PATH [h48h7|h48h10]\n");
        return 2;
    }
#ifndef CUBEROOT_H48_BENCH_LIMIT
    if (strcmp(argv[1], "--bench") == 0) return 2;
#endif
    const char *solver = argc == 3 && strcmp(argv[1], "--bench") != 0
        ? argv[2] : "h48h10";
    if (strcmp(solver, "h48h7") != 0 && strcmp(solver, "h48h10") != 0) {
        fprintf(stderr, "unsupported H48 table: %s\n", solver);
        return 2;
    }
    nissy_setlogger(log_nissy, NULL);
    char dataid[NISSY_SIZE_DATAID] = {0};
    const int64_t size = nissy_solverinfo(solver, dataid);
    if (size <= 0 || strcmp(dataid, solver) != 0) {
        fprintf(stderr, "invalid nissy %s size or data id: %" PRId64 " %s\n", solver, size, dataid);
        return 1;
    }
    fprintf(stderr, "[H48] dataid=%s expected_bytes=%" PRId64 "\n", dataid, size);
    if (strcmp(argv[1], "--info") == 0) return 0;
#ifdef CUBEROOT_H48_BENCH_LIMIT
    if (argc == 3) {
        cuberoot_h48_progress_start(argv[2]);
#ifdef _WIN32
        unsigned char *scratch = (unsigned char *)VirtualAlloc(NULL, (size_t)size, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if (scratch == NULL) { cuberoot_h48_progress_finish(0); return 1; }
#else
        unsigned char *scratch = mmap(NULL, (size_t)size, PROT_READ | PROT_WRITE,
                                      MAP_PRIVATE | CUBEROOT_MAP_ANON, -1, 0);
        if (scratch == MAP_FAILED) { cuberoot_h48_progress_finish(0); return 1; }
#endif
        int64_t generated = nissy_gendata(solver, (uint64_t)size, scratch);
        fprintf(stderr, "\n[H48 BENCH] first %d short states; generated=%" PRId64 "\n",
                CUBEROOT_H48_BENCH_LIMIT, generated);
#if defined(CUBEROOT_H48_BENCH_HASH) && defined(__APPLE__)
        CC_SHA256_CTX hash;
        unsigned char digest[CC_SHA256_DIGEST_LENGTH];
        CC_SHA256_Init(&hash);
        for (uint64_t offset = 0; offset < (uint64_t)size; ) {
            size_t chunk = (size_t)(((uint64_t)size - offset) < (UINT64_C(1) << 20)
                                    ? (uint64_t)size - offset : (UINT64_C(1) << 20));
            CC_SHA256_Update(&hash, scratch + offset, (CC_LONG)chunk);
            offset += chunk;
        }
        CC_SHA256_Final(digest, &hash);
        fprintf(stderr, "[H48 BENCH] full-buffer sha256=");
        for (size_t i = 0; i < sizeof(digest); i++) fprintf(stderr, "%02x", digest[i]);
        fputc('\n', stderr);
#endif
#ifdef _WIN32
        VirtualFree(scratch, 0, MEM_RELEASE);
#else
        munmap(scratch, (size_t)size);
#endif
        cuberoot_h48_progress_finish(generated == size);
        return generated == size ? 0 : 1;
    }
#endif
    cuberoot_h48_progress_start(argv[1]);
    const size_t path_len = strlen(argv[1]);
    char *tmp = (char *)malloc(path_len + 5);
    if (tmp == NULL) { cuberoot_h48_progress_finish(0); return 1; }
    memcpy(tmp, argv[1], path_len);
    memcpy(tmp + path_len, ".tmp", 5);
#ifdef _WIN32
    unsigned char *data = (unsigned char *)VirtualAlloc(NULL, (size_t)size,
                                                        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (data == NULL) {
        fprintf(stderr, "[H48] cannot allocate anonymous table (win32 error %lu)\n", GetLastError());
        free(tmp);
        cuberoot_h48_progress_finish(0);
        return 1;
    }
#else
    /* MAP_ANON has no backing file. Never map the output .tmp as the
     * generation buffer: file-backed writes were orders of magnitude slower. */
    unsigned char *data = mmap(NULL, (size_t)size, PROT_READ | PROT_WRITE,
                               MAP_PRIVATE | CUBEROOT_MAP_ANON, -1, 0);
    if (data == MAP_FAILED) {
        fprintf(stderr, "[H48] cannot allocate anonymous table: %s\n", strerror(errno));
        free(tmp);
        cuberoot_h48_progress_finish(0);
        return 1;
    }
#endif
    fprintf(stderr, "[H48] generating in anonymous memory; validated output will stream to %s\n", tmp);
    const int64_t generated = nissy_gendata(solver, (uint64_t)size, data);
    if (generated != size) {
        fprintf(stderr, "[H48] generation failed: %" PRId64 "\n", generated);
        cuberoot_h48_progress_finish(0);
        return 1;
    }
    fprintf(stderr, "[H48] table populated; validating\n");
    cuberoot_h48_progress_stage(H48_VALIDATE, 0, 0, 0);
    if (nissy_checkdata(solver, (uint64_t)size, data) != NISSY_OK) {
        fprintf(stderr, "[H48] validation failed\n");
        cuberoot_h48_progress_finish(0);
        return 1;
    }
    fprintf(stderr, "[H48] validation passed; streaming to disk\n");
    cuberoot_h48_progress_stage(H48_FLUSH, 0, (uint64_t)size, 0);
#ifdef _WIN32
    HANDLE output = CreateFileA(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (output == INVALID_HANDLE_VALUE) {
        fprintf(stderr, "[H48] cannot open output (win32 error %lu)\n", GetLastError());
        cuberoot_h48_progress_finish(0);
        return 1;
    }
    for (uint64_t offset = 0; offset < (uint64_t)size; ) {
        DWORD chunk = (DWORD)(((uint64_t)size - offset) < (64u << 20)
                             ? (uint64_t)size - offset : (64u << 20));
        DWORD written = 0;
        if (!WriteFile(output, data + offset, chunk, &written, NULL) || written != chunk) {
            fprintf(stderr, "[H48] output write failed (win32 error %lu)\n", GetLastError());
            CloseHandle(output);
            cuberoot_h48_progress_finish(0);
            return 1;
        }
        if (!VirtualFree(data + offset, chunk, MEM_DECOMMIT)) {
            fprintf(stderr, "[H48] cannot release written memory (win32 error %lu)\n", GetLastError());
            CloseHandle(output);
            cuberoot_h48_progress_finish(0);
            return 1;
        }
        offset += chunk;
        cuberoot_h48_progress_done(offset);
    }
    VirtualFree(data, 0, MEM_RELEASE);
    cuberoot_h48_progress_stage(H48_FLUSH, 0, 0, 1);
    if (!FlushFileBuffers(output)) {
        fprintf(stderr, "[H48] flush failed (win32 error %lu)\n", GetLastError());
        CloseHandle(output);
        cuberoot_h48_progress_finish(0);
        return 1;
    }
    CloseHandle(output);
    if (!MoveFileExA(tmp, argv[1], MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        fprintf(stderr, "[H48] rename failed (win32 error %lu)\n", GetLastError());
        cuberoot_h48_progress_finish(0);
        return 1;
    }
#else
    int output = open(tmp, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (output < 0) {
        fprintf(stderr, "[H48] cannot open output: %s\n", strerror(errno));
        cuberoot_h48_progress_finish(0);
        return 1;
    }
#ifdef __APPLE__
#ifdef F_NOCACHE
    (void)fcntl(output, F_NOCACHE, 1);
#endif
#endif
    for (uint64_t offset = 0; offset < (uint64_t)size; ) {
        size_t chunk = (size_t)(((uint64_t)size - offset) < (UINT64_C(64) << 20)
                                ? (uint64_t)size - offset : (UINT64_C(64) << 20));
        size_t sent = 0;
        while (sent < chunk) {
            ssize_t written = write(output, data + offset + sent, chunk - sent);
            if (written < 0 && errno == EINTR) continue;
            if (written <= 0) {
                fprintf(stderr, "[H48] output write failed: %s\n", strerror(errno));
                close(output);
                cuberoot_h48_progress_finish(0);
                return 1;
            }
            sent += (size_t)written;
        }
        if (munmap(data + offset, chunk) != 0) {
            fprintf(stderr, "[H48] cannot release written memory: %s\n", strerror(errno));
            close(output);
            cuberoot_h48_progress_finish(0);
            return 1;
        }
        offset += chunk;
        cuberoot_h48_progress_done(offset);
    }
    cuberoot_h48_progress_stage(H48_FLUSH, 0, 0, 1);
    if (fsync(output) != 0) {
        fprintf(stderr, "[H48] flush failed: %s\n", strerror(errno));
        close(output);
        cuberoot_h48_progress_finish(0);
        return 1;
    }
    if (close(output) != 0) {
        fprintf(stderr, "[H48] close failed: %s\n", strerror(errno));
        cuberoot_h48_progress_finish(0);
        return 1;
    }
    if (rename(tmp, argv[1]) != 0) {
        fprintf(stderr, "[H48] rename failed: %s\n", strerror(errno));
        cuberoot_h48_progress_finish(0);
        return 1;
    }
#endif
    fprintf(stderr, "[H48] wrote %s (%" PRId64 " bytes)\n", argv[1], size);
    cuberoot_h48_progress_finish(1);
    free(tmp);
    return 0;
}
