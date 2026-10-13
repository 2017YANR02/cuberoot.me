/* Only a collector library: use the existing monitored runner to call solve.
 * Include path selects a separately patched original nissy-core snapshot. */
#include "survivor.h"
#include "nissy.c"

typedef struct {
    uint64_t seen_total;
    size_t retained;
    cuberoot_h48_survivor_sample samples[CUBEROOT_H48_SURVIVOR_MAX_SAMPLES];
} survivor_layer;

struct cuberoot_h48_survivor_collector {
    uint64_t seed, key0, key1;
    unsigned capacity;
    char case_id[CUBEROOT_H48_SURVIVOR_CASE_ID_SIZE];
    survivor_layer layers[3];
    wrapthread_define_struct_mutex_t(mutex);
};

static uint64_t survivor_rotl(uint64_t x, unsigned n) {
    return (x << n) | (x >> (64 - n));
}

static void survivor_sipround(uint64_t v[4]) {
    v[0] += v[1]; v[1] = survivor_rotl(v[1], 13); v[1] ^= v[0];
    v[0] = survivor_rotl(v[0], 32);
    v[2] += v[3]; v[3] = survivor_rotl(v[3], 16); v[3] ^= v[2];
    v[0] += v[3]; v[3] = survivor_rotl(v[3], 21); v[3] ^= v[0];
    v[2] += v[1]; v[1] = survivor_rotl(v[1], 17); v[1] ^= v[2];
    v[2] = survivor_rotl(v[2], 32);
}

static uint64_t survivor_siphash24(const unsigned char *input, size_t size,
    uint64_t key0, uint64_t key1) {
    uint64_t v[4] = {
        UINT64_C(0x736f6d6570736575) ^ key0,
        UINT64_C(0x646f72616e646f6d) ^ key1,
        UINT64_C(0x6c7967656e657261) ^ key0,
        UINT64_C(0x7465646279746573) ^ key1,
    };
    size_t offset = 0;
    while (size - offset >= 8) {
        uint64_t word = 0;
        for (unsigned j = 0; j < 8; j++)
            word |= (uint64_t)input[offset + j] << (8 * j);
        v[3] ^= word;
        survivor_sipround(v); survivor_sipround(v);
        v[0] ^= word;
        offset += 8;
    }
    uint64_t tail = (uint64_t)size << 56;
    for (unsigned j = 0; j < size - offset; j++)
        tail |= (uint64_t)input[offset + j] << (8 * j);
    v[3] ^= tail;
    survivor_sipround(v); survivor_sipround(v);
    v[0] ^= tail;
    v[2] ^= UINT64_C(0xff);
    for (unsigned i = 0; i < 4; i++) survivor_sipround(v);
    return v[0] ^ v[1] ^ v[2] ^ v[3];
}

static uint64_t survivor_splitmix_next(uint64_t *state) {
    uint64_t z = (*state += UINT64_C(0x9e3779b97f4a7c15));
    z = (z ^ (z >> 30)) * UINT64_C(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)) * UINT64_C(0x94d049bb133111eb);
    return z ^ (z >> 31);
}

static int survivor_compare(const cuberoot_h48_survivor_sample *a,
    const cuberoot_h48_survivor_sample *b) {
    if (a->priority < b->priority) return -1;
    if (a->priority > b->priority) return 1;
    return memcmp(a->cube, b->cube, NISSY_SIZE_CUBE);
}

static void survivor_insert(cuberoot_h48_survivor_collector *collector,
    const cuberoot_h48_survivor_sample *sample) {
    survivor_layer *layer = &collector->layers[sample->remaining - 10];
    layer->seen_total++;
    size_t position = 0;
    for (size_t i = 0; i < layer->retained; i++) {
        if (!memcmp(sample->cube, layer->samples[i].cube, NISSY_SIZE_CUBE))
            return; /* Retain the first selected visit's context. */
        if (survivor_compare(&layer->samples[i], sample) < 0) position++;
    }
    if (position >= collector->capacity) return;
    const size_t new_count = layer->retained < collector->capacity ?
        layer->retained + 1 : layer->retained;
    if (new_count > position + 1)
        memmove(&layer->samples[position + 1], &layer->samples[position],
            (new_count - position - 1) * sizeof *sample);
    layer->samples[position] = *sample;
    layer->retained = new_count;
}

static void survivor_capture(cube_t cube, uint8_t remaining, uint8_t normal,
    uint8_t inverse_bound, void *data) {
    cuberoot_h48_survivor_collector *collector = data;
    if (collector == NULL || remaining < 10 || remaining > 12) return;
    cuberoot_h48_survivor_sample sample = {
        .remaining = remaining, .lb_normal = normal, .lb_inverse = inverse_bound,
    };
    const oriented_cube_t oriented = {.cube = cube, .orientation = ORIENTATION_UF};
    if (writecube(oriented, sizeof sample.cube, sample.cube) != NISSY_OK) return;
    /* Stable bytes: one raw budget byte, then the 23 ASCII cube characters.
     * Never hash SIMD storage, compiler padding or a platform-endian integer. */
    unsigned char input[NISSY_SIZE_CUBE];
    input[0] = remaining;
    memcpy(input + 1, sample.cube, NISSY_SIZE_CUBE - 1);
    sample.priority = survivor_siphash24(input, sizeof input,
        collector->key0, collector->key1);
    wrapthread_mutex_lock(&collector->mutex);
    memcpy(sample.case_id, collector->case_id, sizeof sample.case_id);
    survivor_insert(collector, &sample);
    wrapthread_mutex_unlock(&collector->mutex);
}

cuberoot_h48_survivor_collector *cuberoot_h48_survivor_create(
    uint64_t seed, unsigned capacity_per_layer) {
    if (capacity_per_layer < 1 || capacity_per_layer > CUBEROOT_H48_SURVIVOR_MAX_SAMPLES)
        return NULL;
    cuberoot_h48_survivor_collector *collector = calloc(1, sizeof *collector);
    if (collector == NULL) return NULL;
    collector->capacity = capacity_per_layer;
    wrapthread_mutex_init(&collector->mutex);
    cuberoot_h48_survivor_clear(collector, seed);
    return collector;
}

long long cuberoot_h48_survivor_clear(cuberoot_h48_survivor_collector *collector,
    uint64_t seed) {
    if (collector == NULL) return NISSY_ERROR_NULL_POINTER;
    collector->seed = seed;
    collector->key0 = survivor_splitmix_next(&seed);
    collector->key1 = survivor_splitmix_next(&seed);
    memset(collector->case_id, 0, sizeof collector->case_id);
    memset(collector->layers, 0, sizeof collector->layers);
    return NISSY_OK;
}

long long cuberoot_h48_survivor_set_case(cuberoot_h48_survivor_collector *collector,
    const char *case_id) {
    if (collector == NULL || case_id == NULL) return NISSY_ERROR_NULL_POINTER;
    const size_t size = strlen(case_id);
    if (size == 0 || size >= sizeof collector->case_id) return NISSY_ERROR_OPTIONS;
    memset(collector->case_id, 0, sizeof collector->case_id);
    memcpy(collector->case_id, case_id, size);
    return NISSY_OK;
}

long long cuberoot_h48_survivor_attach(cuberoot_h48_survivor_collector *collector) {
    if (collector != NULL && collector->case_id[0] == '\0') return NISSY_ERROR_OPTIONS;
    h48_survivor_observer = collector == NULL ? NULL : survivor_capture;
    h48_survivor_observer_data = collector;
    return NISSY_OK;
}

void cuberoot_h48_survivor_free(cuberoot_h48_survivor_collector *collector) {
    if (collector == NULL) return;
    if (h48_survivor_observer_data == collector) cuberoot_h48_survivor_attach(NULL);
#if WRAPTHREAD_PTHREADS
    pthread_mutex_destroy(&collector->mutex);
#elif WRAPTHREAD_C11THREADS
    mtx_destroy(&collector->mutex);
#endif
    free(collector);
}

long long cuberoot_h48_survivor_get_layer_stats(
    const cuberoot_h48_survivor_collector *collector, unsigned remaining,
    cuberoot_h48_survivor_layer_stats *stats) {
    if (collector == NULL || stats == NULL) return NISSY_ERROR_NULL_POINTER;
    if (remaining < 10 || remaining > 12) return NISSY_ERROR_OPTIONS;
    const survivor_layer *layer = &collector->layers[remaining - 10];
    *stats = (cuberoot_h48_survivor_layer_stats) {
        .remaining = remaining, .seen_total = layer->seen_total,
        .retained = layer->retained,
    };
    return NISSY_OK;
}

long long cuberoot_h48_survivor_get_sample(
    const cuberoot_h48_survivor_collector *collector, unsigned remaining,
    size_t index, cuberoot_h48_survivor_sample *sample) {
    if (collector == NULL || sample == NULL) return NISSY_ERROR_NULL_POINTER;
    if (remaining < 10 || remaining > 12) return NISSY_ERROR_OPTIONS;
    const survivor_layer *layer = &collector->layers[remaining - 10];
    if (index >= layer->retained) return NISSY_ERROR_OPTIONS;
    *sample = layer->samples[index];
    return NISSY_OK;
}

static void survivor_json_string(FILE *output, const char *string) {
    fputc('"', output);
    for (const unsigned char *p = (const unsigned char *)string; *p; p++) {
        if (*p == '"' || *p == '\\') {
            fputc('\\', output); fputc(*p, output);
        } else if (*p < 0x20) {
            fprintf(output, "\\u%04x", (unsigned)*p);
        } else {
            fputc(*p, output);
        }
    }
    fputc('"', output);
}

long long cuberoot_h48_survivor_write_jsonl(
    const cuberoot_h48_survivor_collector *collector, FILE *output) {
    if (collector == NULL || output == NULL) return NISSY_ERROR_NULL_POINTER;
    fprintf(output, "{\"type\":\"metadata\",\"schema\":\"cuberoot.h48-survivors.v1\","
        "\"seed\":\"0x%016" PRIx64 "\",\"capacity_per_layer\":%u,"
        "\"sampling\":\"bottom_k_siphash24\",\"unit\":\"distinct_full_cube_per_remaining\","
        "\"context\":\"first_retained_visit\",\"unique_total\":null,\"layers\":[",
        collector->seed, collector->capacity);
    for (unsigned i = 0; i < 3; i++) {
        const survivor_layer *layer = &collector->layers[i];
        fprintf(output, "%s{\"remaining\":%u,\"seen_total\":%" PRIu64
            ",\"retained\":%zu,\"unique_total\":null}",
            i == 0 ? "" : ",", i + 10, layer->seen_total, layer->retained);
    }
    fputs("]}\n", output);
    for (unsigned i = 0; i < 3; i++) {
        const survivor_layer *layer = &collector->layers[i];
        for (size_t j = 0; j < layer->retained; j++) {
            const cuberoot_h48_survivor_sample *sample = &layer->samples[j];
            fputs("{\"type\":\"sample\",\"case_id\":", output);
            survivor_json_string(output, sample->case_id);
            fputs(",\"cube\":", output);
            survivor_json_string(output, sample->cube);
            fprintf(output, ",\"remaining\":%u,\"lb_normal\":%u,\"lb_inverse\":%u,"
                "\"priority\":\"0x%016" PRIx64 "\"}\n", sample->remaining,
                sample->lb_normal, sample->lb_inverse, sample->priority);
        }
    }
    return ferror(output) ? NISSY_ERROR_UNKNOWN : NISSY_OK;
}
