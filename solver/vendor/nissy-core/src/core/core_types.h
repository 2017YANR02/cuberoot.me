#ifndef CORE_CORE_TYPES_H
#define CORE_CORE_TYPES_H

typedef struct {
	cube_t cube;
	uint8_t orientation;
} oriented_cube_t;

typedef struct {
	size_t nnormal;
	size_t ninverse;
	uint8_t normal[NISSY_SIZE_MOVES];
	uint8_t inverse[NISSY_SIZE_MOVES];
} moves_struct_t;

#endif /* CORE_CORE_TYPES_H */
