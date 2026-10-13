/* Exhaustive depth-two projection oracle, independent of the DFS pruning. */
#define JOINT_PROBE_TEST
#include "probe.c"

#define SHORT_STATES (1 + NMOVES + NMOVES * NMOVES)

typedef struct { uint8_t bytes[9]; } projection_key;
typedef struct { cube_t cube; unsigned depth; } short_state;

static projection_key projected(cube_t cube, unsigned edge) {
    uint8_t corners[8], edges[12];
    projection_key key = {{0}};
    pieces(&cube, corners, edges);
    memcpy(key.bytes, corners, 8);
    for (unsigned i = 0; i < 12; i++)
        if ((edges[i] & PBITS) == edge)
            key.bytes[8] = (uint8_t)(2 * i + ((edges[i] & EOBIT) != 0));
    return key;
}

static void require(bool condition, const char *message) {
    if (!condition) { fprintf(stderr, "FAIL: %s\n", message); exit(1); }
}

static void verify_found(cube_t cube, unsigned edge, unsigned r, joint_result result) {
    require(result.length <= r, "found length exceeds r");
    for (unsigned i = 0; i < result.length; i++) {
        require(result.moves[i] < NMOVES, "invalid found move");
        cube = move(cube, result.moves[i]);
    }
    projection_key actual = projected(cube, edge), solved = projected(SOLVED_CUBE, edge);
    require(!memcmp(&actual, &solved, sizeof actual), "found path fails projected goal");
}

int main(int argc, char **argv) {
    require(argc == 2, "usage: joint-probe-test CORNERS");
    nissy_setlogger(NULL, NULL);
    joint_tables tables;
    require(joint_load_corners(argv[1], &tables), "load existing corner table");
    short_state states[SHORT_STATES];
    unsigned count = 0;
    states[count++] = (short_state){SOLVED_CUBE, 0};
    for (uint8_t first = 0; first < NMOVES; first++)
        states[count++] = (short_state){move(SOLVED_CUBE, first), 1};
    for (uint8_t first = 0; first < NMOVES; first++)
        for (uint8_t second = 0; second < NMOVES; second++)
            states[count++] = (short_state){move(move(SOLVED_CUBE, first), second), 2};
    require(count == SHORT_STATES, "all zero/one/two-move words enumerated");

    unsigned decisions = 0, transitions = 0;
    for (unsigned edge = 0; edge < 12; edge++) {
        projection_key keys[SHORT_STATES];
        for (unsigned i = 0; i < count; i++) keys[i] = projected(states[i].cube, edge);
        for (unsigned i = 0; i < count; i++) {
            /* Every word of length <=2, with no pruning and no heuristic.
             * Therefore its first projection occurrence is the exact distance. */
            unsigned distance = 3;
            for (unsigned j = 0; j < count; j++)
                if (!memcmp(&keys[i], &keys[j], sizeof keys[i]) && states[j].depth < distance)
                    distance = states[j].depth;
            require(distance <= 2, "projection present in independent breadth-first ball");
            require(joint_lower_bound(&tables, states[i].cube, edge) <= distance,
                "heuristic overestimates independent distance");
            for (unsigned r = 0; r <= 2; r++) {
                joint_result result = joint_probe(&tables, states[i].cube, edge, r, 20000, 5000);
                require(result.status == (distance <= r ? JOINT_FOUND : JOINT_EXHAUSTED),
                    "bounded decision differs from independent breadth-first distance");
                require(result.lower_bound <= distance, "reported lower bound overestimates");
                if (result.status == JOINT_FOUND) verify_found(states[i].cube, edge, r, result);
                else require(result.lower_bound > r, "complete exhaustion must certify >r");
                decisions++;
            }
            for (uint8_t m = 0; m < NMOVES; m++) {
                projection_key child = projected(move(states[i].cube, m), edge);
                require(tables.edge_move[keys[i].bytes[8]][m] == child.bytes[8],
                    "single-edge transition differs from full-cube move");
                transitions++;
            }
        }
    }

    /* A valid non-solved cube with solved corners and selected UF edge must
     * already satisfy the relaxed target. Other edge identities are free. */
    uint8_t corners[8], edges[12];
    cube_t solved = SOLVED_CUBE;
    pieces(&solved, corners, edges);
    edges[1] = 2; edges[2] = 3; edges[3] = 1;
    cube_t relaxed = cubefromarray(corners, edges);
    oriented_cube_t oriented = {.cube = relaxed, .orientation = ORIENTATION_UF};
    require(isconsistent(oriented) && issolvable(oriented), "relaxed fixture is legal");
    require(!equal(relaxed, SOLVED_CUBE), "relaxed fixture is not fully solved");
    joint_result target = joint_probe(&tables, relaxed, EDGE_UF, 0, 20, 1000);
    require(target.status == JOINT_FOUND && target.length == 0, "free edges do not affect goal");

    joint_result node_zero = joint_probe(&tables, SOLVED_CUBE, EDGE_UF, 0, 0, 1000);
    require(node_zero.status == JOINT_UNKNOWN && node_zero.nodes == 0 &&
        !strcmp(node_zero.stop_reason, "node_limit"), "zero node budget must be unknown");
    joint_result time_zero = joint_probe(&tables, SOLVED_CUBE, EDGE_UF, 0, 20, 0);
    require(time_zero.status == JOINT_UNKNOWN && time_zero.nodes == 0 &&
        !strcmp(time_zero.stop_reason, "time_limit"), "zero time budget must be unknown");
    cube_t two_moves = move(move(SOLVED_CUBE, MOVE_U), MOVE_R);
    joint_result truncated = joint_probe(&tables, two_moves, EDGE_UF, 2, 1, 1000);
    require(truncated.status == JOINT_UNKNOWN && truncated.nodes == 1 &&
        !strcmp(truncated.stop_reason, "node_limit"), "partial traversal must not become proof");

    printf("{\"status\":\"passed\",\"shortWords\":%u,\"edges\":12,"
        "\"boundedDecisions\":%u,\"edgeTransitions\":%u,\"budgetChecks\":3}\n",
        count, decisions, transitions);
    free(tables.bytes);
    return 0;
}
