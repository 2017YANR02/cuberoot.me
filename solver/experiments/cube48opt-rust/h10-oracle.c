/* SPDX-License-Identifier: GPL-3.0-or-later
 * Low-memory coordinate oracle using the preserved nissy-core snapshot
 * 1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88 (see its LICENSE).
 *
 * Usage: h10-oracle H10_TABLE < id-tab-scramble.tsv > NEW_ORACLE.tsv
 * Reads the three 512-byte headers, ~2 MB auxiliary payloads, and one
 * 64-byte main-table row per output state. Never maps or scans the main
 * PDB, generates tables, or invokes a solver.
 * Execute only through the task's monitored runner.
 *
 * Each input yields normal and inverse rows. TSV columns:
 * id, side(0/1), scramble, Nissy20hex, rawCOCSEP, rawESEP, rawEO,
 * cdata, H10index, cornerBound, EOESEPindex, EOESEPbound,
 * mainCode, lineMin, mainBound, completeBound,
 * followed by 48 transformed edge12hex fields in Nissy symmetry order.
 */
#include <assert.h>
#include <ctype.h>
#include <stdio.h>
#include <sys/stat.h>
#define THREADS 1
#include "../../vendor/nissy-core/src/nissy.c"

#define H10_FILE_BYTES UINT64_C(30336314216)
#define MAIN_HEADER_OFFSET UINT64_C(1120256)
#define EOESEP_HEADER_OFFSET UINT64_C(30335374336)

static void read_at(FILE *file, uint64_t offset, void *out, size_t bytes) {
    assert(offset <= H10_FILE_BYTES && bytes <= H10_FILE_BYTES - offset);
    assert(fseeko(file, (off_t)offset, SEEK_SET) == 0);
    assert(fread(out, 1, bytes, file) == bytes);
}

static tableinfo_t header(FILE *file, uint64_t offset) {
    unsigned char bytes[INFOSIZE];
    tableinfo_t info;
    read_at(file, offset, bytes, sizeof bytes);
    assert(readtableinfo(sizeof bytes, bytes, &info) == NISSY_OK);
    assert(info.infosize == INFOSIZE);
    return info;
}

static void hex_bytes(const uint8_t *bytes, size_t length) {
    for (size_t i = 0; i < length; i++) printf("%02x", bytes[i]);
}

static void emit(FILE *file, const char *id, unsigned side, const char *scramble,
                 cube_t cube, const uint32_t *cocsep, const uint32_t *esep,
                 const unsigned char *eoesep) {
    uint8_t corners[8], edges[12];
    pieces(&cube, corners, edges);
    uint64_t raw = coord_cocsep(cube);
    uint32_t cdata = cocsep[raw];
    uint64_t aux = coord_eoesep_sym(cube, esep);
    uint64_t index = coord_h48(cube, cocsep, 10);
    unsigned char line[H48_LINE_BYTES];
    read_at(file, MAIN_HEADER_OFFSET + INFOSIZE + H48_LINE_BYTES * H48_LINE(index), line, sizeof line);
    uint8_t line_min, code = get_h48_pval_and_min(line, index % H48_LINE_COORDS, &line_min);
    uint8_t auxiliary_bound = get_eoesep_pval(eoesep, aux);
    uint8_t main_bound = code ? 10 + code : MAX(line_min, auxiliary_bound);
    assert(raw < COCSEP_TABLESIZE && COCLASS(cdata) < COCSEP_CLASSES);
    assert(TTREP(cdata) < NTRANS && CBOUND(cdata) <= 9);
    assert(aux < EOESEP_TABLESIZE);
    printf("%s\t%u\t%s\t", id, side, scramble);
    hex_bytes(corners, 8); hex_bytes(edges, 12);
    printf("\t%" PRIu64 "\t%" PRIu64 "\t%" PRIu64 "\t%" PRIu32
           "\t%" PRIu64 "\t%" PRIu32 "\t%" PRIu64 "\t%u",
           raw, coord_esep(cube), coord_eo(cube), cdata,
           index, CBOUND(cdata), aux, auxiliary_bound);
    printf("\t%u\t%u\t%u\t%u", code, line_min, main_bound,
           MAX(CBOUND(cdata), main_bound));
    for (uint8_t t = 0; t < NTRANS; t++) {
        cube_t transformed = transform_edges(cube, t);
        pieces(&transformed, corners, edges);
        putchar('\t'); hex_bytes(edges, 12);
    }
    putchar('\n');
}

int main(int argc, char **argv) {
    assert(argc == 2 && "usage: h10-oracle H10_TABLE < cases.tsv");
    const uint32_t endian = 1;
    assert(*(const unsigned char *)&endian == 1 && "fixed table is little-endian");
    nissy_setlogger(NULL, NULL);
    FILE *file = fopen(argv[1], "rb");
    assert(file != NULL);
    struct stat statbuf;
    assert(fstat(fileno(file), &statbuf) == 0 && S_ISREG(statbuf.st_mode));
    assert((uint64_t)statbuf.st_size == H10_FILE_BYTES);
    tableinfo_t corner_info = header(file, 0);
    tableinfo_t main_info = header(file, MAIN_HEADER_OFFSET);
    tableinfo_t edge_info = header(file, EOESEP_HEADER_OFFSET);
    assert(corner_info.fullsize == COCSEP_FULLSIZE);
    assert(corner_info.next == MAIN_HEADER_OFFSET);
    assert(corner_info.entries == COCSEP_TABLESIZE && corner_info.bits == 32);
    assert(corner_info.classes == COCSEP_CLASSES && corner_info.maxvalue == 9);
    assert(corner_info.type == TABLETYPE_SPECIAL && corner_info.base == 0);
    assert(main_info.h48h == 10 && main_info.bits == 2 && main_info.base == 10);
    /* gendata_h48.h records two metadata slots per physical row, including
     * the final row. Logical coordinates still range over H48_COORDMAX(10). */
    assert(main_info.entries == H48_COORDMAX(10) + 2 * H48_LINES(10));
    assert(main_info.fullsize == INFOSIZE + H48_TABLESIZE(10));
    assert(main_info.next == main_info.fullsize);
    assert(main_info.type == TABLETYPE_PRUNING && main_info.classes == 0 && main_info.maxvalue == 3);
    assert(MAIN_HEADER_OFFSET + main_info.next == EOESEP_HEADER_OFFSET);
    assert(edge_info.entries == EOESEP_TABLESIZE && edge_info.bits == 4);
    assert(edge_info.classes == ESEP_CLASSES && edge_info.maxvalue == 11);
    assert(edge_info.fullsize == EOESEP_FULLSIZE);
    assert(edge_info.type == TABLETYPE_SPECIAL && edge_info.base == 0);
    assert(EOESEP_HEADER_OFFSET + edge_info.fullsize == H10_FILE_BYTES);
    assert(edge_info.next == 0);
    uint32_t *cocsep = malloc(COCSEP_TABLESIZE * sizeof(uint32_t));
    uint32_t *esep = malloc(ESEP_MAX * sizeof(uint32_t));
    unsigned char *eoesep = malloc(EOESEP_BUF);
    assert(cocsep && esep && eoesep);
    read_at(file, INFOSIZE, cocsep, COCSEP_TABLESIZE * sizeof(uint32_t));
    read_at(file, EOESEP_HEADER_OFFSET + INFOSIZE, esep, ESEP_MAX * sizeof(uint32_t));
    read_at(file, EOESEP_HEADER_OFFSET + INFOSIZE + ESEP_MAX * sizeof(uint32_t), eoesep, EOESEP_BUF);
    char line[8192];
    size_t cases = 0;
    while (fgets(line, sizeof line, stdin)) {
        size_t length = strlen(line);
        assert(length && line[length - 1] == '\n' && "complete bounded input line required");
        line[--length] = 0;
        if (length && line[length - 1] == '\r') line[--length] = 0;
        char *tab = strchr(line, '\t');
        assert(tab && tab != line); *tab++ = 0;
        assert(strchr(tab, '\t') == NULL);
        for (char *p = line; *p; p++) assert(isalnum((unsigned char)*p) || *p == '-' || *p == '_');
        for (char *p = tab; *p; p++) assert(strchr("URFDLB2' ", *p) != NULL);
        oriented_cube_t cube = applymoves(SOLVED_ORIENTED_CUBE, tab);
        assert(!iserror(cube) && issolvable(cube) && cube.orientation == 0);
        emit(file, line, 0, tab, cube.cube, cocsep, esep, eoesep);
        emit(file, line, 1, tab, inverse(cube.cube), cocsep, esep, eoesep);
        cases++;
    }
    assert(!ferror(stdin) && cases > 0);
    assert(fflush(stdout) == 0 && !ferror(stdout));
    assert(fclose(file) == 0);
    fprintf(stderr, "h10 coordinate oracle: %zu inputs, %zu normal/inverse rows; auxiliary tables and sampled main rows only\n", cases, cases * 2);
    free(cocsep); free(esep); free(eoesep);
    return 0;
}
