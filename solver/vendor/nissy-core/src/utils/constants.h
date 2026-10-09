#ifndef UTILS_CONSTANTS_H
#define UTILS_CONSTANTS_H

#define UINT8_BIT(i) (UINT8_C(1) << (uint8_t)(i))

#define FACTORIAL_MAX UINT64_C(12)

#define POW_2_11   UINT64_C(2048)
#define POW_3_7    UINT64_C(2187)
#define FACT_12    UINT64_C(479001600)
#define FACT_8     UINT64_C(40320)
#define FACT_4     UINT64_C(24)
#define COMB_12_4  UINT64_C(495)
#define COMB_8_4   UINT64_C(70)

#define UINT8_ERROR UINT8_MAX

STATIC uint64_t factorial[FACTORIAL_MAX+1] = {
	[0] = 1,
	[1] = 1,
	[2] = 2,
	[3] = 6,
	[4] = 24,
	[5] = 120,
	[6] = 720,
	[7] = 5040,
	[8] = 40320,
	[9] = 362880,
	[10] = 3628800,
	[11] = 39916800,
	[12] = 479001600,
};

STATIC uint64_t binomial[12][12] = {
	{1,  0,  0,   0,   0,   0,   0,   0,   0,  0,  0, 0},
	{1,  1,  0,   0,   0,   0,   0,   0,   0,  0,  0, 0},
	{1,  2,  1,   0,   0,   0,   0,   0,   0,  0,  0, 0},
	{1,  3,  3,   1,   0,   0,   0,   0,   0,  0,  0, 0},
	{1,  4,  6,   4,   1,   0,   0,   0,   0,  0,  0, 0},
	{1,  5, 10,  10,   5,   1,   0,   0,   0,  0,  0, 0},
	{1,  6, 15,  20,  15,   6,   1,   0,   0,  0,  0, 0},
	{1,  7, 21,  35,  35,  21,   7,   1,   0,  0,  0, 0},
	{1,  8, 28,  56,  70,  56,  28,   8,   1,  0,  0, 0},
	{1,  9, 36,  84, 126, 126,  84,  36,   9,  1,  0, 0},
	{1, 10, 45, 120, 210, 252, 210, 120,  45, 10,  1, 0},
	{1, 11, 55, 165, 330, 462, 462, 330, 165, 55, 11, 1},
};

#endif /* UTILS_CONSTANTS_H */
