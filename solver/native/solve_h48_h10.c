/* Persistent native H48 h10 solver for the 333opt statistics pipeline.
 * Reads id,scramble on stdin and writes id,htm,solution on stdout.
 * The table is mapped read-only once, so one process serves the full corpus.
 */
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

#define H10_BYTES 30336314216ULL
#define INPUT_SIZE 8192
#define SOLUTIONS_SIZE 4096

int main(int argc, char **argv) {
    if (argc != 3) {
        fprintf(stderr, "usage: solve_h48_h10 TABLE THREADS\n");
        return 2;
    }
    const unsigned threads = (unsigned)strtoul(argv[2], NULL, 10);
    if (!threads || threads > THREADS) {
        fprintf(stderr, "invalid thread count %u (compiled maximum %d)\n", threads, THREADS);
        return 2;
    }
    const unsigned char *data = NULL;
#ifdef _WIN32
    HANDLE file = CreateFileA(argv[1], GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    LARGE_INTEGER size;
    if (file == INVALID_HANDLE_VALUE || !GetFileSizeEx(file, &size) || (uint64_t)size.QuadPart != H10_BYTES) {
        fprintf(stderr, "missing or incomplete H48 h10 table: %s\n", argv[1]);
        return 1;
    }
    HANDLE mapping = CreateFileMappingA(file, NULL, PAGE_READONLY, 0, 0, NULL);
    if (mapping) data = (const unsigned char *)MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 0);
#else
    const int file = open(argv[1], O_RDONLY);
    struct stat st;
    if (file < 0 || fstat(file, &st) != 0 || (uint64_t)st.st_size != H10_BYTES) {
        fprintf(stderr, "missing or incomplete H48 h10 table: %s\n", argv[1]);
        return 1;
    }
    data = mmap(NULL, H10_BYTES, PROT_READ, MAP_PRIVATE, file, 0);
    if (data == MAP_FAILED) data = NULL;
#endif
    if (!data) { fprintf(stderr, "cannot map H48 h10 table\n"); return 1; }
    nissy_setlogger(NULL, NULL);
    char line[INPUT_SIZE];
    unsigned long long done = 0;
    while (fgets(line, sizeof line, stdin)) {
        char *comma = strchr(line, ',');
        if (!comma || !strchr(line, '\n')) { fprintf(stderr, "invalid or oversized input line\n"); return 1; }
        *comma = '\0';
        char *scramble = comma + 1;
        scramble[strcspn(scramble, "\r\n")] = '\0';
        char cube[NISSY_SIZE_CUBE];
        long long rc = nissy_applymoves(NISSY_SOLVED_CUBE, scramble, cube);
        if (rc != NISSY_OK) { fprintf(stderr, "invalid scramble id=%s rc=%lld\n", line, rc); return 1; }
        char solutions[SOLUTIONS_SIZE] = {0};
        long long stats[NISSY_SIZE_SOLVE_STATS] = {0};
        rc = nissy_solve(cube, "h48h10", NISSY_NISSFLAG_NORMAL, 0, 20, 1, 0, threads,
                         H10_BYTES, data, sizeof solutions, solutions, stats, NULL, NULL);
        if (rc < 1) { fprintf(stderr, "H48 h10 failed id=%s rc=%lld\n", line, rc); return 1; }
        solutions[strcspn(solutions, "\r\n")] = '\0';
        const long long htm = nissy_countmoves(solutions);
        if (htm < 0) { fprintf(stderr, "invalid H48 solution id=%s\n", line); return 1; }
        char verified[NISSY_SIZE_CUBE];
        if (nissy_applymoves(cube, solutions, verified) != NISSY_OK ||
            strcmp(verified, NISSY_SOLVED_CUBE) != 0) {
            fprintf(stderr, "H48 solution did not solve id=%s\n", line);
            return 1;
        }
        printf("%s,%lld,%s\n", line, htm, solutions);
        fflush(stdout);
        if (++done % 100 == 0) fprintf(stderr, "[H48 h10] solved %llu\n", done);
    }
#ifdef _WIN32
    UnmapViewOfFile(data); CloseHandle(mapping); CloseHandle(file);
#else
    munmap((void *)data, H10_BYTES); close(file);
#endif
    return ferror(stdin) ? 1 : 0;
}
