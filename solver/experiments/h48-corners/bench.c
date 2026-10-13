/* Shared exploratory H10 worker. Run through the monitored TS launcher.
 * H48_ORIGINAL links the unmodified vendor nissy.c and emits one solve per
 * input; the candidate build alternates baseline/candidate then candidate/
 * baseline. H48_BPMX selects bound propagation instead of the corner bound.
 * All variants keep the existing H10 table mapped read-only throughout. */
#define _POSIX_C_SOURCE 200809L
#ifdef __APPLE__
#define _DARWIN_C_SOURCE
#endif
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include "nissy.h"
#if defined(H48_BPMX)
#include "bpmx.h"
#elif !defined(H48_ORIGINAL)
#include "engine.h"
#endif

#define H10_BYTES UINT64_C(30336314216)
#define MAX_CORNER_BYTES (16U * 1024U * 1024U)
#define INPUT_SIZE 8192
#define SOLUTION_SIZE 4096

static unsigned char *allocate_table(size_t size) {
    void *data = NULL;
    return posix_memalign(&data, 64, size) == 0 ? data : NULL;
}

static bool absent(const char *path) {
    struct stat st;
    if (lstat(path, &st) < 0 && errno == ENOENT) return true;
    fprintf(stderr, "refusing existing or inaccessible output: %s\n", path);
    return false;
}

static bool write_all(int fd, const unsigned char *data, size_t size) {
    size_t offset = 0;
    while (offset < size) {
        ssize_t count = write(fd, data + offset, size - offset);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0) return false;
        offset += (size_t)count;
    }
    return true;
}

static int generate_corners(const char *path) {
    if (!absent(path)) return 1;
    size_t path_size = strlen(path) + sizeof ".tmp";
    char *temporary = malloc(path_size);
    if (temporary == NULL) return 1;
    snprintf(temporary, path_size, "%s.tmp", path);
    /* O_EXCL protects a previous interrupted result; never truncate it. */
    int output = open(temporary, O_WRONLY | O_CREAT | O_EXCL, 0644);
    if (output < 0) {
        perror("create corner table temporary file");
        free(temporary);
        return 1;
    }
    char dataid[NISSY_SIZE_DATAID] = {0};
    long long bytes = nissy_solverinfo("corners", dataid);
    unsigned char *data = NULL;
    int result = 1;
    if (bytes <= 0 || bytes > MAX_CORNER_BYTES) {
        fprintf(stderr, "unexpected corner table size: %lld\n", bytes);
        goto done;
    }
    data = allocate_table((size_t)bytes);
    if (data == NULL) goto done;
    fprintf(stderr, "generating corner table: %lld bytes\n", bytes);
    if (nissy_gendata("corners", (unsigned long long)bytes, data) != bytes ||
        nissy_checkdata("corners", (unsigned long long)bytes, data) != NISSY_OK) {
        fprintf(stderr, "corner table generation or validation failed\n");
        goto done;
    }
    if (!write_all(output, data, (size_t)bytes) || fsync(output) < 0) {
        perror("write corner table");
        goto done;
    }
    if (close(output) < 0) {
        output = -1;
        perror("close corner table");
        goto done;
    }
    output = -1;
#ifdef __APPLE__
    /* Atomic rename with a no-replace guarantee, including concurrent writes. */
    if (renamex_np(temporary, path, RENAME_EXCL) < 0) {
        perror("publish corner table");
        goto done;
    }
#else
    /* POSIX rename can overwrite: hard-link publication is atomic and cannot
     * replace an existing destination. Both paths are on the same filesystem. */
    if (link(temporary, path) < 0 || unlink(temporary) < 0) {
        perror("publish corner table");
        goto done;
    }
#endif
    printf("{\"type\":\"corners-generated\",\"bytes\":%lld}\n", bytes);
    result = fflush(stdout) == 0 ? 0 : 1;
done:
    if (output >= 0) close(output);
    if (result != 0)
        fprintf(stderr, "failed; temporary result retained at %s\n", temporary);
    free(data);
    free(temporary);
    return result;
}

#if !defined(H48_ORIGINAL) && !defined(H48_BPMX)
static unsigned char *read_corners(const char *path, size_t *size) {
    int fd = open(path, O_RDONLY);
    struct stat st;
    unsigned char *data = NULL;
    if (fd < 0 || fstat(fd, &st) < 0 || !S_ISREG(st.st_mode) ||
        st.st_size <= 0 || (uint64_t)st.st_size > MAX_CORNER_BYTES)
        goto done;
    *size = (size_t)st.st_size;
    data = allocate_table(*size);
    if (data == NULL) goto done;
    size_t offset = 0;
    while (offset < *size) {
        ssize_t count = read(fd, data + offset, *size - offset);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0) {
            free(data);
            data = NULL;
            break;
        }
        offset += (size_t)count;
    }
done:
    if (fd >= 0) close(fd);
    if (data == NULL) fprintf(stderr, "cannot read corner table: %s\n", path);
    return data;
}
#endif

static const unsigned char *map_h10(const char *path) {
    int fd = open(path, O_RDONLY);
    struct stat st;
    const unsigned char *data = NULL;
    if (fd >= 0 && fstat(fd, &st) == 0 && S_ISREG(st.st_mode) &&
        (uint64_t)st.st_size == H10_BYTES) {
        data = mmap(NULL, (size_t)H10_BYTES, PROT_READ, MAP_PRIVATE, fd, 0);
        if (data == MAP_FAILED) data = NULL;
    }
    if (fd >= 0) close(fd);
    if (data == NULL) fprintf(stderr, "cannot map complete H10 table: %s\n", path);
    return data;
}

static void json_string(const char *value) {
    putchar('"');
    for (const unsigned char *p = (const unsigned char *)value; *p; p++) {
        if (*p == '"' || *p == '\\') printf("\\%c", *p);
        else if (*p < 0x20) printf("\\u%04x", (unsigned)*p);
        else putchar(*p);
    }
    putchar('"');
}

static double seconds_between(struct timespec start, struct timespec end) {
    return (double)(end.tv_sec - start.tv_sec) +
        (double)(end.tv_nsec - start.tv_nsec) / 1000000000.0;
}

static int benchmark(const char *h10_path, const char *corners_path,
    unsigned threads) {
    int result = 1;
#if !defined(H48_ORIGINAL) && !defined(H48_BPMX)
    size_t corner_size = 0;
    unsigned char *corner_data = read_corners(corners_path, &corner_size);
    cuberoot_h48_corners_engine *engine = NULL;
    if (corner_data == NULL) return 1;
    if (cuberoot_h48_corners_init(corner_data, corner_size, &engine) != NISSY_OK) {
        fprintf(stderr, "corner table validation failed\n");
        free(corner_data);
        return 1;
    }
#else
    (void)corners_path;
#endif
    const unsigned char *h10 = map_h10(h10_path);
    if (h10 == NULL) goto done;
    char line[INPUT_SIZE];
    uint64_t index = 0;
    while (fgets(line, sizeof line, stdin)) {
        char *comma = strchr(line, ',');
        if (comma == NULL || comma == line || strchr(line, '\n') == NULL) {
            fprintf(stderr, "invalid/oversized input at index %" PRIu64 "\n", index);
            goto done;
        }
        *comma = '\0';
        char *scramble = comma + 1;
        scramble[strcspn(scramble, "\r\n")] = '\0';
        char cube[NISSY_SIZE_CUBE];
        if (nissy_applymoves(NISSY_SOLVED_CUBE, scramble, cube) != NISSY_OK) {
            fprintf(stderr, "invalid scramble at index %" PRIu64 "\n", index);
            goto done;
        }
#ifdef H48_ORIGINAL
        const unsigned runs = 1;
#else
        const unsigned runs = 2;
        long long previous_length = -1;
        unsigned order = 0;
        /* Stable per-ID order; r1/r2/r3 IDs reverse each case across rounds. */
        for (const unsigned char *p = (const unsigned char *)line; *p; p++)
            order ^= *p & 1U;
#endif
        for (unsigned run = 0; run < runs; run++) {
            char solution[SOLUTION_SIZE] = {0};
            long long stats[NISSY_SIZE_SOLVE_STATS] = {0};
            uint64_t corner_lookups = 0, corner_prunes = 0;
            const char *mode;
            long long count;
            struct timespec start, end;
#ifdef H48_ORIGINAL
            mode = "original";
#else
            bool candidate = ((order + run) % 2) != 0;
            mode = candidate ? "candidate" : "baseline";
#endif
            if (clock_gettime(CLOCK_MONOTONIC, &start) < 0) goto done;
#ifdef H48_BPMX
            cuberoot_h48_bpmx_enable(candidate);
#elif !defined(H48_ORIGINAL)
            if (candidate) {
                cuberoot_h48_corners_stats observed = {0};
                count = cuberoot_h48_corners_solve(engine, scramble, threads,
                    h10, (size_t)H10_BYTES, solution, sizeof solution, stats,
                    &observed);
                corner_lookups = observed.lookups;
                corner_prunes = observed.prunes;
            } else
#endif
            {
                count = nissy_solve(cube, "h48h10", NISSY_NISSFLAG_NORMAL,
                    0, 20, 1, 0, threads, H10_BYTES, h10, sizeof solution,
                    solution, stats, NULL, NULL);
            }
            if (clock_gettime(CLOCK_MONOTONIC, &end) < 0) goto done;
            if (count != 1 || memchr(solution, '\0', sizeof solution) == NULL) {
                fprintf(stderr, "%s failed at index %" PRIu64 ": %lld\n",
                    mode, index, count);
                goto done;
            }
            solution[strcspn(solution, "\r\n")] = '\0';
            long long length = nissy_countmoves(solution);
            char verified[NISSY_SIZE_CUBE];
            if (length < 0 || length > 20 ||
                nissy_applymoves(cube, solution, verified) != NISSY_OK ||
                strcmp(verified, NISSY_SOLVED_CUBE) != 0) {
                fprintf(stderr, "%s invalid solution at index %" PRIu64 "\n",
                    mode, index);
                goto done;
            }
#ifndef H48_ORIGINAL
            if (run != 0 && length != previous_length) {
                fprintf(stderr, "optimal length mismatch at index %" PRIu64
                    ": %lld vs %lld\n", index, previous_length, length);
                goto done;
            }
            previous_length = length;
#endif
            printf("{\"id\":");
            json_string(line);
            printf(",\"index\":%" PRIu64 ",\"run\":%u,\"mode\":\"%s\","
                "\"length\":%lld,\"solution\":", index, run, mode, length);
            json_string(solution);
            printf(",\"seconds\":%.9f,\"nodes\":%lld,\"lookups\":%lld,"
                "\"fallbacks\":%lld,\"cornerLookups\":%" PRIu64 ","
                "\"cornerPrunes\":%" PRIu64 ",\"faceCuts\":%lld,\"bpmxCuts\":%lld,"
                "\"bpmxSkipped\":%lld,\"recursiveCuts\":%lld,\"verified\":true,\"stats\":[",
                seconds_between(start, end), stats[0], stats[1], stats[2],
                corner_lookups, corner_prunes,
#ifdef H48_BPMX
                stats[6], stats[7], stats[8], stats[9]
#else
                0LL, 0LL, 0LL, 0LL
#endif
            );
            for (unsigned i = 0; i < NISSY_SIZE_SOLVE_STATS; i++)
                printf("%s%lld", i ? "," : "", stats[i]);
            puts("]}");
            if (fflush(stdout) != 0) goto done;
        }
        index++;
    }
    result = ferror(stdin) ? 1 : 0;
done:
    if (h10 != NULL) munmap((void *)h10, (size_t)H10_BYTES);
#if !defined(H48_ORIGINAL) && !defined(H48_BPMX)
    cuberoot_h48_corners_free(engine);
    free(corner_data);
#endif
    return result;
}

int main(int argc, char **argv) {
    nissy_setlogger(NULL, NULL);
    if (argc == 3 && strcmp(argv[1], "--generate-corners") == 0)
        return generate_corners(argv[2]);
    if (argc == 5 && strcmp(argv[1], "--benchmark") == 0) {
        char *end;
        errno = 0;
        unsigned long threads = strtoul(argv[4], &end, 10);
        if (errno == 0 && argv[4][0] >= '0' && argv[4][0] <= '9' &&
            *end == '\0' && threads >= 1 && threads <= THREADS &&
            threads <= INT8_MAX)
            return benchmark(argv[2], argv[3], (unsigned)threads);
        fprintf(stderr, "threads must be 1..%d (and at most %d)\n", THREADS, INT8_MAX);
        return 2;
    }
    fprintf(stderr, "usage: h48-corners --generate-corners OUTPUT\n"
        "       h48-corners --benchmark H10 CORNERS THREADS\n"
        "stdin: id,scramble followed by newline; indices/runs are zero-based\n");
    return 2;
}
