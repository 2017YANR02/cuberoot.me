struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "L F2 U2 L' B2 U2 R2 B2 D2 R' F2 U2 F2 U2",
	.solutions =
		"U2 F2 D2 F2 R B2 L2 U2 L B2 L F2 D2 F2\n"
		"L' F2 L' B2 R D2 R U2 R2 F2 U2 F2 L' B2\n"
		"L' F2 L' B2 L B2 R F2 L2 U2 B2 U2 R' B2\n"
		"L U2 F2 R2 D2 F2 R B2 D2 L' D2 R2 B2 L2\n"
		"U2 F2 U2 F2 R D2 B2 R2 U2 B2 L U2 F2 L'\n"
		"U2 F2 D2 B2 R' U2 B2 L2 U2 F2 L' D2 B2 L'\n"
		"R B2 U2 R2 F2 U2 L B2 D2 R2 L' B2 L2 U2\n"
		"R2 L' D2 B2 R2 U2 B2 L D2 F2 R B2 L2 U2\n"
		"R2 L' D2 B2 L2 D2 F2 L U2 B2 R F2 R2 U2\n"
		"R' L2 F2 D2 R2 B2 D2 L F2 U2 L B2 L2 U2\n"
		"L U2 F2 R2 D2 F2 L U2 B2 R' L2 B2 L2 U2\n"
		"L U2 F2 L2 U2 B2 L D2 F2 R' L2 F2 R2 U2\n"
		"F2 U2 R D2 B2 R2 U2 B2 L B2 R U2 F2 D2\n"
},
[1] = {
	.scramble = "R D2 U2 R' L2 U2 L B2 R2 D2 B2 U2 B2 U2",
	.solutions =
		"L2 F2 R' B2 L F2 B2 L' F2 U2 F2 D2 R2 F2\n"
		"D2 U2 F2 R2 D2 L' D2 U2 L D2 R F2 U2 R2\n"
		"F2 R2 B2 D2 L' U2 F2 D2 L' D2 R F2 D2 R2\n"
		"B2 L2 D2 L F2 B2 L' U2 F2 B2 R F2 U2 R2\n"
		"U2 B2 U2 B2 D2 R2 B2 L' U2 R L2 D2 U2 R'\n"
		"D2 F2 U2 F2 U2 R2 B2 L' U2 R L2 D2 U2 R'\n"
		"U2 L' B2 U2 B2 L D2 B2 L2 D2 B2 L B2 L2\n"
		"F2 R2 B2 D2 R' F2 D2 B2 R' U2 R B2 U2 L2\n"
		"B2 U2 L' F2 U2 F2 L D2 L2 D2 B2 L B2 L2\n"
		"U2 B2 U2 B2 D2 L2 F2 R2 L U2 L' F2 B2 L'\n"
		"U2 B2 U2 B2 L2 F2 R2 U2 R B2 R' F2 B2 L'\n"
		"D2 F2 U2 F2 U2 L2 F2 R2 L U2 L' F2 B2 L'\n"
		"D2 F2 U2 F2 R2 B2 L2 D2 R B2 R' F2 B2 L'\n"
		"U2 B2 U2 B2 D2 R2 B2 L' U2 R' D2 U2 R L2\n"
		"D2 F2 U2 F2 U2 R2 B2 L' U2 R' D2 U2 R L2\n"
		"U2 B2 U2 R F2 B2 R' L2 B2 L D2 L2 B2 U2\n"
		"U2 B2 U2 R F2 B2 L D2 R' B2 L2 D2 L2 U2\n"
		"U2 B2 U2 R' L2 F2 B2 R B2 L D2 L2 B2 U2\n"
		"U2 B2 U2 L D2 U2 L B2 R2 L' U2 R2 B2 U2\n"
},
[2] = {
	.scramble = "L2 D2 L' D2 R U2 B2 L2 U2 B2 L' D2 F2 R' F2",
	.solutions =
		"B2 R B2 R2 D2 R' F2 U2 L2 D2 R F2 U2 R' F2\n"
		"B2 R B2 L2 U2 R' B2 D2 R2 D2 R F2 U2 R' F2\n"
		"B2 R' D2 L2 F2 R B2 D2 R2 D2 L D2 F2 L' F2\n"
		"B2 L U2 R2 B2 L' F2 U2 L2 D2 L D2 F2 L' F2\n"
		"U2 F2 R B2 R2 F2 U2 R U2 R2 B2 L D2 R' B2\n"
		"U2 F2 R B2 R2 F2 U2 L F2 R2 U2 L B2 L' B2\n"
		"U2 F2 R B2 L2 B2 D2 L B2 L2 U2 L B2 L' B2\n"
		"U2 F2 L U2 R2 D2 F2 L D2 R2 F2 R B2 L' B2\n"
		"U2 F2 L U2 L2 U2 B2 L U2 L2 F2 R B2 L' B2\n"
		"F2 R D2 R2 D2 B2 L' B2 U2 R2 D2 R B2 L' B2\n"
		"F2 R D2 L2 U2 F2 L' F2 D2 L2 D2 R B2 L' B2\n"
		"F2 R F2 D2 L B2 U2 L2 B2 U2 R' D2 L D2 L2\n"
		"D2 F2 L' U2 L B2 D2 L2 U2 R D2 L' D2 L2 U2\n"
},
[3] = {
	.scramble = "R2 U2 R' U2 L' B2 L2 F2 R2 U2 R D2 B2 R U2",
	.solutions =
		"L' D2 R' B2 L D2 R2 D2 F2 R F2 R' F2 L' F2\n"
		"U2 R2 L U2 B2 L B2 R2 D2 B2 L U2 R U2 R2\n"
		"U2 R' B2 D2 R' U2 R2 F2 L2 B2 L U2 R U2 R2\n"
		"U2 R' B2 D2 L' B2 R2 U2 L2 D2 L B2 L U2 R2\n"
		"U2 L2 B2 R' B2 D2 L D2 L' F2 L2 D2 L U2 R2\n"
		"U2 L' D2 F2 L' D2 L2 F2 L2 B2 R B2 L U2 R2\n"
		"B2 R U2 L U2 R' F2 R2 B2 U2 R' F2 L D2 L\n"
		"B2 L F2 R U2 L' U2 L2 U2 F2 R' D2 R D2 L\n"
		"B2 L F2 L F2 L' F2 R2 B2 U2 R' F2 L D2 L\n"
		"U2 R2 F2 R' F2 U2 R B2 R D2 R2 B2 L' D2 L2\n"
		"U2 R2 F2 L' U2 B2 R D2 L D2 R2 B2 L' D2 L2\n"
		"U2 R' B2 D2 R' U2 L2 B2 L2 F2 L D2 R D2 L2\n"
		"U2 R' B2 D2 L' B2 R2 U2 R2 U2 L F2 L D2 L2\n"
		"U2 L2 B2 R' B2 D2 R F2 R U2 L2 B2 L' D2 L2\n"
		"U2 L2 B2 R' B2 D2 L D2 L' F2 R2 U2 L D2 L2\n"
		"U2 L2 B2 L' D2 F2 R U2 L U2 L2 B2 L' D2 L2\n"
		"U2 L' D2 F2 R U2 R2 B2 U2 R U2 R' L2 D2 L2\n"
		"D2 L' F2 D2 R2 F2 L' F2 D2 L F2 B2 U2 L' U2\n"
		"D2 F2 U2 F2 L F2 L2 B2 R' F2 U2 L U2 R' D2\n"
},
[4] = {
	.scramble = "R D2 R' F2 L' F2 D2 U2 R' B2 U2 R2 U2 L2",
	.solutions =
		"F2 B2 D2 R F2 R' B2 L2 U2 F2 D2 B2 L2 F2\n"
		"F2 B2 D2 R F2 R' F2 R2 D2 F2 U2 B2 R2 B2\n"
		"L2 U2 R2 U2 B2 R D2 U2 F2 L F2 R D2 R'\n"
		"R2 D2 L' F2 U2 R D2 F2 U2 L2 B2 L D2 L'\n"
		"L2 U2 R2 U2 B2 L F2 B2 D2 R F2 L B2 L'\n"
		"L2 U2 L' B2 D2 R U2 B2 D2 R2 B2 L D2 L'\n"
		"B2 D2 L' D2 U2 B2 L' U2 L' B2 U2 B2 R U2\n"
},
[5] = {
	.scramble = "R2 U2 B2 D2 U2 L F2 R' D2 R2 U2 F2 U2 R",
	.solutions =
		"D2 U2 F2 L2 D2 B2 L F2 U2 R D2 R2 L F2\n"
		"F2 L2 U2 F2 L B2 D2 R D2 L2 F2 B2 L F2\n"
		"B2 D2 R2 F2 L2 B2 U2 L' U2 F2 L F2 R' F2\n"
		"B2 R2 D2 F2 D2 U2 L F2 U2 R D2 R2 L F2\n"
		"U2 B2 R2 F2 B2 D2 R F2 D2 L U2 R L2 B2\n"
		"D2 F2 L2 U2 R B2 D2 F2 B2 L U2 R L2 B2\n"
		"F2 R2 U2 B2 R2 L' F2 U2 R D2 L' D2 U2 B2\n"
		"R D2 B2 R F2 L2 U2 B2 D2 R' D2 U2 F2 R2\n"
		"R' U2 F2 U2 R2 D2 R F2 L' D2 U2 B2 U2 R2\n"
		"R' U2 F2 U2 L2 U2 R B2 L' D2 U2 F2 D2 L2\n"
		"R2 B2 R F2 B2 D2 L' B2 R2 D2 B2 L' B2 U2\n"
		"L2 F2 R F2 B2 U2 L' F2 L2 D2 B2 L' B2 U2\n"
		"R2 F2 D2 B2 U2 R B2 R2 F2 L B2 L F2 D2\n"
		"F2 D2 R2 F2 R2 B2 U2 R' F2 R' U2 R F2 D2\n"
		"R' D2 B2 D2 R2 U2 L B2 R' B2 D2 L2 D2 U2\n"
		"R' D2 B2 D2 L2 D2 L F2 R' F2 U2 R2 D2 U2\n"
},
[6] = {
	.scramble = "R' U2 L' F2 D2 R' F2 R' U2 F2 B2 R2 F2",
	.solutions =
		"U2 B2 L2 F2 L' B2 D2 R F2 L' U2 B2 R\n"
		"F2 R2 F2 B2 U2 R F2 R D2 F2 L U2 R\n"
		"B2 L2 U2 R F2 R D2 U2 B2 R' D2 B2 R\n"
},
[7] = {
	.scramble = "U2 R D2 R' U2 R B2 R2 U2 B2 U2 L' D2 L'",
	.solutions =
		"D2 L2 U2 R' D2 R U2 R' F2 L U2 F2 R' U2\n"
		"L D2 R B2 D2 B2 L2 U2 L' U2 L B2 L' U2\n"
		"L D2 L U2 B2 U2 R2 B2 R' U2 R D2 R' U2\n"
},
[8] = {
	.scramble = "R B2 D2 R F2 L F2 L2 F2 B2 D2 L2 F2 R'",
	.solutions =
		"R F2 L2 D2 F2 B2 L2 F2 L' F2 R' D2 B2 R'\n"
		"R B2 R2 U2 F2 B2 R2 B2 L' F2 R' D2 B2 R'\n"
		"R' U2 R' F2 L2 F2 U2 R2 B2 U2 L D2 B2 R'\n"
		"R' U2 R' B2 R2 F2 D2 L2 F2 U2 L D2 B2 R'\n"
		"L D2 U2 R2 F2 D2 U2 L U2 R2 L D2 B2 R'\n"
		"L' B2 U2 R2 D2 U2 R2 U2 L D2 L' D2 B2 R'\n"
		"L' B2 U2 L2 D2 U2 L2 U2 L D2 L' D2 B2 R'\n"
		"L' B2 D2 U2 R2 D2 U2 L' U2 R2 L D2 B2 R'\n"
		"L' B2 D2 R2 D2 U2 R2 D2 L D2 L' D2 B2 R'\n"
		"L' B2 D2 L2 D2 U2 L2 D2 L D2 L' D2 B2 R'\n"
		"R' F2 U2 R2 U2 B2 L U2 L F2 R F2 D2 L2\n"
		"R' B2 D2 L2 D2 F2 L U2 L F2 R F2 D2 L2\n"
		"R F2 L2 D2 F2 B2 L2 F2 R' D2 R' B2 U2 L'\n"
		"R F2 B2 L2 D2 F2 B2 L F2 R2 L B2 U2 L'\n"
		"R B2 R2 U2 F2 B2 R2 B2 R' D2 R' B2 U2 L'\n"
		"R' U2 F2 R2 F2 B2 R2 F2 L B2 L' B2 U2 L'\n"
		"R' U2 F2 L2 F2 B2 L2 F2 L B2 L' B2 U2 L'\n"
		"R' U2 F2 B2 R2 F2 B2 L' F2 R2 L B2 U2 L'\n"
		"R' U2 B2 R2 F2 B2 R2 B2 L B2 L' B2 U2 L'\n"
		"R' U2 B2 L2 F2 B2 L2 B2 L B2 L' B2 U2 L'\n"
		"L U2 R2 F2 D2 U2 R2 U2 L' D2 R' B2 U2 L'\n"
		"L D2 L2 B2 D2 U2 L2 D2 L' D2 R' B2 U2 L'\n"
		"L' B2 R' U2 L2 U2 B2 L2 U2 F2 L B2 U2 L'\n"
		"L' B2 R' D2 R2 U2 F2 R2 D2 F2 L B2 U2 L'\n"
		"R U2 R2 F2 B2 R B2 L U2 L' U2 R2 B2 U2\n"
		"R' U2 B2 R2 F2 L' B2 L B2 D2 L D2 R2 U2\n"
},
[9] = {
	.scramble = "R' B2 D2 L D2 F2 R D2 F2 L' U2 R2 U2 R",
	.solutions =
		"R F2 D2 R B2 R' B2 R' B2 L2 B2 R' F2 B2\n"
		"R F2 D2 L U2 R' U2 R' U2 L2 U2 L' F2 B2\n"
		"R F2 D2 L U2 R' U2 L' B2 L2 B2 R' F2 B2\n"
		"L D2 B2 R U2 L B2 R2 F2 R' F2 R F2 B2\n"
		"L D2 B2 R U2 L' B2 R' B2 L2 B2 R' F2 B2\n"
		"L D2 B2 L' F2 R2 B2 L D2 L F2 R F2 B2\n"
		"R' U2 R2 U2 L F2 D2 R' F2 D2 L' D2 B2 R\n"
		"L F2 L' F2 R' F2 U2 L2 D2 U2 F2 R' B2 L\n"
		"L' B2 L2 F2 R F2 D2 L' U2 F2 L' F2 D2 L\n"
},
[10] = {
	.scramble = "R2 D2 R B2 L U2 L2 D2 U2 R' U2 B2 R2",
	.solutions =
		"R2 B2 U2 R D2 U2 L2 U2 L' B2 R' D2 R2\n"
		"R2 B2 U2 R' U2 R2 D2 U2 L B2 R' D2 R2\n"
		"R2 B2 U2 R D2 U2 R2 D2 L' F2 R' U2 L2\n"
		"L D2 F2 D2 F2 R U2 R U2 L2 U2 F2 D2\n"
},
[11] = {
	.scramble = "U2 L F2 D2 F2 U2 R U2 L U2 R'",
	.solutions =
		"R U2 L' U2 R' U2 F2 D2 F2 L' U2\n"
		"L F2 L' F2 L' U2 F2 D2 F2 L' U2\n"
},
[12] = {
	.scramble = "R2 D2 U2 R' B2 U2 R' F2 R' D2 F2 L2",
	.solutions =
		"L2 F2 D2 R F2 R U2 B2 R D2 U2 R2\n"
		"L2 F2 D2 L D2 R F2 U2 L D2 U2 L2\n"
},
[13] = {
	.scramble = "R D2 R F2 R B2 D2 U2 R D2 L' F2 L'",
	.solutions =
		"U2 B2 D2 R U2 L' U2 B2 L2 F2 B2 D2 R2\n"
		"L F2 L D2 R' D2 U2 B2 R' F2 R' D2 R'\n"
		"R2 D2 R' D2 F2 B2 R' F2 R' U2 R U2 L2\n"
		"R2 D2 L' F2 D2 U2 R' U2 R' B2 L U2 L2\n"
		"U2 F2 D2 F2 D2 L2 B2 L2 B2 R U2 L' D2\n"
		"U2 B2 U2 F2 U2 R2 B2 R2 F2 R U2 L' D2\n"
		"D2 F2 U2 B2 D2 R2 B2 R2 F2 R U2 L' D2\n"
		"D2 B2 D2 B2 U2 L2 B2 L2 B2 R U2 L' D2\n"
},
[14] = {
	.scramble = "F2 R2 U2 F2 B2 L' U2 R' B2 R2 L' D2 L2",
	.solutions =
		"R' L' B2 L' D2 R B2 R F2 B2 D2 L2 F2\n"
		"L2 D2 R2 L B2 R U2 L F2 B2 U2 R2 F2\n"
},
[15] = {
	.scramble = "R D2 L D2 U2 F2 L' D2 R F2 D2 R2 D2 L B2",
	.solutions =
		"B2 R' U2 R' D2 L D2 F2 B2 R D2 R2 D2 R F2\n"
		"F2 L U2 R' U2 F2 R' U2 L' D2 B2 L2 U2 F2 R'\n"
		"B2 L B2 R2 U2 L' U2 F2 U2 B2 L D2 L' U2 R'\n"
		"B2 L' D2 R2 D2 F2 R' D2 L F2 D2 U2 L' D2 R'\n"
		"B2 L' D2 R2 F2 R B2 U2 B2 D2 L F2 R' U2 R'\n"
		"B2 R' B2 L2 F2 U2 L' U2 R D2 F2 B2 L' B2 L'\n"
		"F2 R D2 B2 R' D2 L D2 R D2 R2 F2 L B2 U2\n"
		"F2 R D2 B2 L' F2 R U2 R' B2 R2 U2 L' B2 U2\n"
		"F2 R D2 B2 L' F2 L F2 L D2 R2 F2 L B2 U2\n"
		"F2 L B2 U2 R' B2 R D2 L' U2 L2 B2 R' B2 U2\n"
},
[16] = {
	.scramble = "U2 F2 R D2 L' U2 R B2 R B2 R' U2 R",
	.solutions =
		"R' U2 R B2 R' F2 R' U2 B2 R' U2 L F2\n"
		"R' U2 L U2 R' D2 R' F2 U2 R' F2 R F2\n"
		"R' U2 R B2 R' B2 R' U2 L D2 R' F2 U2\n"
		"R' U2 L U2 R' U2 L' U2 L D2 R' F2 U2\n"
},
[17] = {
	.scramble = "L2 U2 R' B2 R2 F2 D2 L' F2 D2 R2 U2 L' D2 F2",
	.solutions =
		"F2 D2 L U2 R2 D2 F2 L D2 F2 R2 B2 R U2 L2\n"
		"L2 U2 B2 L' F2 R2 F2 D2 R' D2 L2 B2 R B2 D2\n"
		"L2 U2 B2 L' F2 L2 B2 U2 L U2 R2 F2 L' B2 D2\n"
		"F2 R2 D2 F2 R F2 L2 D2 L' F2 L2 U2 R' B2 D2\n"
		"F2 R2 D2 F2 L' B2 R2 U2 R B2 R2 U2 R' B2 D2\n"
		"F2 R2 D2 F2 L' B2 L2 D2 L' F2 L2 D2 L B2 D2\n"
		"F2 L2 U2 B2 R B2 R2 D2 R B2 R2 D2 L B2 D2\n"
},
[18] = {
	.scramble = "B2 D2 B2 L' U2 L' B2 L' F2 B2 U2 R F2",
	.solutions =
		"F2 R' U2 F2 B2 L B2 L U2 L B2 D2 B2\n"
},
[19] = {
	.scramble = "R2 B2 R' F2 L' U2 L U2 B2 L U2 B2 L' U2 R2",
	.solutions =
		"R2 U2 L B2 U2 L' B2 U2 L' U2 L F2 R B2 R2\n"
		"R2 U2 R D2 B2 R' B2 U2 R' F2 L D2 L F2 L2\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
