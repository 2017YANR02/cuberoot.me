#ifndef SOLVERS_TABLES_TYPES_MACROS_H
#define SOLVERS_TABLES_TYPES_MACROS_H

#define OFFSET(B, K)             (((unsigned char *)B) + K)

#define INFOSIZE                 INT64_C(512)
#define INFO_SOLVER_STRLEN       INT64_C(100)
#define INFO_DISTRIBUTION_LEN    INT64_C(21)

#define TABLETYPE_PRUNING        UINT64_C(0)
#define TABLETYPE_SPECIAL        UINT64_C(1)
#define TABLETYPE_MULTI          UINT64_C(2)

#define INFO_OFFSET_DISTRIBUTION 0
#define INFO_OFFSET_TYPE         (INFO_DISTRIBUTION_LEN * sizeof(uint64_t))
#define INFO_OFFSET_INFOSIZE     (INFO_OFFSET_TYPE + sizeof(uint64_t))
#define INFO_OFFSET_FULLSIZE     (INFO_OFFSET_INFOSIZE + sizeof(uint64_t))
#define INFO_OFFSET_HASH         (INFO_OFFSET_FULLSIZE + sizeof(uint64_t))
#define INFO_OFFSET_ENTRIES      (INFO_OFFSET_HASH + sizeof(uint64_t))
#define INFO_OFFSET_CLASSES      (INFO_OFFSET_ENTRIES + sizeof(uint64_t))
#define INFO_OFFSET_NEXT         (INFO_OFFSET_CLASSES + sizeof(uint64_t))
#define INFO_OFFSET_SOLVER       (INFO_OFFSET_NEXT + sizeof(uint64_t))
#define INFO_OFFSET_H48H         (INFO_OFFSET_SOLVER + INFO_SOLVER_STRLEN)
#define INFO_OFFSET_BITS         (INFO_OFFSET_H48H + sizeof(uint8_t))
#define INFO_OFFSET_BASE         (INFO_OFFSET_BITS + sizeof(uint8_t))
#define INFO_OFFSET_MAXVALUE     (INFO_OFFSET_BASE + sizeof(uint8_t))

typedef struct {
	uint64_t distribution[INFO_DISTRIBUTION_LEN];
	uint64_t type;
	uint64_t infosize;
	uint64_t fullsize;
	uint64_t hash; /* Currently unused */
	uint64_t entries;
	uint64_t classes; /* Used only by cocsepdata, for now */
	uint64_t next;
	char solver[INFO_SOLVER_STRLEN];
	uint8_t h48h; /* Specific to H48 tables */
	uint8_t bits;
	uint8_t base;
	uint8_t maxvalue;
} tableinfo_t;

#endif /* SOLVERS_TABLES_TYPES_MACROS_H */
