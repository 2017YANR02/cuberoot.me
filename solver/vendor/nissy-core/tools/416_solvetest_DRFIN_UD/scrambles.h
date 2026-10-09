struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "F2 U' L2 U F2 R2 U' R2 D L2 D' R2 U",
	.solutions =
		"U' R2 D L2 D' R2 U R2 F2 U' L2 U F2\n"
},
[1] = {
	.scramble = "U' B2 D2 R2 U' R2 L2 U2 B2 R2 D' R2 U2",
	.solutions =
		"U2 R2 D R2 B2 U2 R2 L2 U R2 D2 B2 U\n"
		"D2 L2 D L2 F2 D2 R2 L2 D' L2 U2 F2 D'\n"
},
[2] = {
	.scramble = "U B2 R2 U F2 L2 D B2 D' F2 U F2 L2 F2",
	.solutions =
		"F2 R2 F2 U' B2 D F2 D' L2 B2 U' R2 B2 U'\n"
		"F2 L2 F2 U' F2 D B2 D' L2 F2 U' R2 B2 U'\n"
},
[3] = {
	.scramble = "U B2 D2 L2 U F2 L2 D B2 R2 U F2",
	.solutions =
		"F2 U' R2 B2 D' L2 F2 U' L2 D2 B2 U'\n"
},
[4] = {
	.scramble = "U2 F2 U L2 F2 D' F2 R2 D2 R2 D F2 U2",
	.solutions =
		"U2 F2 D' R2 D2 R2 F2 D F2 L2 U' F2 U2\n"
		"B2 D2 B2 U R2 D2 B2 D' R2 F2 D' F2 U2\n"
		"D2 B2 D' L2 D2 L2 B2 D B2 R2 U' B2 D2\n"
		"B2 D2 B2 D' L2 U2 F2 U L2 B2 D' B2 D2\n"
},
[5] = {
	.scramble = "U2 R2 F2 D' F2 B2 L2 F2 U' B2 U L2 D2",
	.solutions =
		"D2 L2 U' R2 F2 D' F2 B2 L2 F2 U' B2 U2\n"
		"D2 L2 U' B2 U F2 L2 F2 B2 D F2 R2 U2\n"
},
[6] = {
	.scramble = "B2 U L2 B2 L2 B2 U2 L2 D B2 U R2 D' R2",
	.solutions =
		"U2 L2 F2 B2 U' R2 U R2 D' R2 F2 B2 U B2\n"
		"U2 L2 F2 B2 D' F2 U F2 U' R2 F2 B2 U B2\n"
		"R2 D R2 U' B2 D' L2 U2 B2 L2 B2 L2 U' B2\n"
},
[7] = {
	.scramble = "D F2 U' F2 U' F2 L2 B2 R2 U' F2 U' F2 R2",
	.solutions =
		"F2 U L2 F2 R2 F2 U' B2 U R2 U2 B2 D2 F2\n"
		"F2 D F2 R2 B2 R2 D' B2 D' R2 U' D' L2 F2\n"
		"F2 L2 U' F2 L2 D R2 U' B2 U' F2 B2 U F2\n"
		"F2 L2 D' L2 B2 D F2 U' R2 U' R2 L2 D F2\n"
		"U R2 L2 U2 R2 F2 D L2 F2 D' L2 U2 R2 B2\n"
		"U B2 D R2 B2 D R2 U B2 U' L2 B2 L2 B2\n"
		"R2 U' R2 L2 D F2 B2 U R2 D B2 D' R2 B2\n"
		"R2 D' F2 B2 D R2 L2 D R2 D B2 D' R2 B2\n"
		"R2 D F2 B2 U' B2 R2 F2 U' B2 D' R2 D R2\n"
		"U D2 L2 F2 D L2 F2 D' L2 F2 R2 B2 D2 L2\n"
		"R2 F2 U F2 U R2 B2 L2 F2 U F2 U F2 D'\n"
},
[8] = {
	.scramble = "R2 L2 U' F2 L2 U' B2 L2 D F2 U' R2 B2",
	.solutions =
		"U L2 D' L2 B2 R2 B2 U R2 B2 D L2 F2\n"
		"B2 R2 F2 D2 F2 D' B2 R2 U B2 U2 L2 F2\n"
		"R2 L2 U F2 D' B2 D' F2 L2 D' L2 F2 B2\n"
		"U B2 R2 U F2 D L2 B2 U B2 L2 F2 L2\n"
		"D L2 B2 U R2 U L2 B2 U B2 L2 F2 L2\n"
		"L2 F2 R2 U' R2 F2 B2 U R2 U F2 D' L2\n"
		"L2 F2 R2 D' F2 R2 L2 U F2 D F2 D' L2\n"
		"B2 R2 U F2 D' L2 B2 U L2 F2 U R2 L2\n"
},
[9] = {
	.scramble = "R2 U2 L2 F2 U' F2 U2 R2 F2 R2 F2 U L2 D",
	.solutions =
		"D' L2 U' F2 R2 F2 R2 U2 F2 U F2 L2 U2 R2\n"
},
[10] = {
	.scramble = "F2 B2 D' B2 L2 U F2 D' L2 B2 D' B2 D' R2",
	.solutions =
		"R2 D B2 D B2 L2 D F2 U' L2 B2 D F2 B2\n"
},
[11] = {
	.scramble = "U2 B2 U B2 U2 R2 D' F2 D2 F2 R2 D' R2 L2",
	.solutions =
		"D B2 L2 U2 L2 D' B2 L2 U2 R2 D F2 U2 F2\n"
		"D B2 L2 D2 R2 D' F2 R2 D2 R2 D F2 U2 F2\n"
		"U B2 L2 U2 L2 D' B2 L2 U2 R2 U' B2 U2 B2\n"
		"U B2 L2 D2 R2 D' F2 R2 D2 R2 U' B2 U2 B2\n"
		"D B2 L2 U2 L2 U B2 L2 D2 R2 U' B2 D2 B2\n"
		"D B2 L2 D2 R2 U F2 R2 U2 R2 U' B2 D2 B2\n"
		"L2 U2 F2 U' F2 D2 R2 U' B2 U2 B2 R2 D R2\n"
		"L2 U2 F2 D F2 U2 R2 D B2 U2 B2 R2 D R2\n"
		"L2 U2 F2 D' L2 B2 U2 B2 D L2 U2 F2 D' R2\n"
		"L2 U2 F2 D' L2 B2 D2 F2 U' R2 D2 B2 U R2\n"
		"L2 D2 B2 U' B2 U2 R2 U' B2 U2 B2 R2 D R2\n"
		"L2 D2 B2 D B2 D2 R2 D B2 U2 B2 R2 D R2\n"
		"L2 D2 B2 D' R2 F2 U2 F2 U' R2 D2 B2 U R2\n"
		"L2 D2 B2 D' R2 F2 D2 B2 D L2 U2 F2 D' R2\n"
		"U L2 F2 U2 F2 D' L2 U2 B2 U B2 U2 R2 L2\n"
		"U L2 F2 U2 F2 D' L2 D2 F2 U F2 D2 R2 L2\n"
		"U L2 F2 D2 B2 U R2 U2 B2 D' F2 D2 R2 L2\n"
		"U L2 F2 D2 B2 U R2 D2 F2 D' B2 U2 R2 L2\n"
		"U' F2 D2 R2 D' F2 U2 F2 R2 U' F2 D2 R2 L2\n"
		"U' F2 D2 R2 D' F2 D2 B2 L2 U' B2 U2 R2 L2\n"
		"D F2 U2 R2 U F2 U2 F2 R2 U' F2 D2 R2 L2\n"
		"D F2 U2 R2 U F2 D2 B2 L2 U' B2 U2 R2 L2\n"
		"R2 L2 U F2 U2 R2 D B2 U2 F2 L2 D' B2 U2\n"
		"R2 L2 D R2 F2 U2 B2 U' L2 D2 F2 D B2 U2\n"
		"R2 L2 D R2 F2 D2 F2 D R2 U2 B2 U' B2 U2\n"
		"R2 L2 D' F2 D2 R2 U' B2 U2 F2 L2 D' B2 U2\n"
		"R2 L2 U F2 U2 R2 D B2 D2 B2 R2 D' F2 D2\n"
		"R2 L2 D R2 F2 U2 B2 U' L2 U2 B2 D F2 D2\n"
		"R2 L2 D R2 F2 D2 F2 D R2 D2 F2 U' F2 D2\n"
		"R2 L2 D' F2 D2 R2 U' B2 D2 B2 R2 D' F2 D2\n"
},
[12] = {
	.scramble = "U' B2 L2 U R2 D L2 U2 R2 B2 U F2 D R2 D'",
	.solutions =
		"F2 U' L2 B2 D' F2 U2 L2 B2 R2 B2 D' F2 U F2\n"
		"F2 D' B2 R2 U' F2 D2 R2 F2 L2 F2 U' L2 D F2\n"
		"U2 L2 D B2 D L2 U' L2 F2 D' R2 U' L2 B2 U\n"
		"D R2 D' F2 U' B2 R2 U2 L2 D' R2 U' L2 B2 U\n"
		"D2 R2 D F2 D R2 D' F2 R2 D' B2 D' L2 B2 U\n"
		"U F2 U' F2 U' B2 R2 U2 L2 D' R2 D' B2 R2 D\n"
		"U F2 D' L2 U' R2 F2 U2 B2 U' R2 D' B2 R2 D\n"
		"U F2 D' L2 D' F2 L2 U2 R2 U' F2 U' B2 R2 D\n"
		"D R2 U' R2 D' B2 R2 U2 L2 D' R2 D' B2 R2 D\n"
		"D R2 D' F2 D' R2 F2 U2 B2 D' F2 U' B2 R2 D\n"
		"D2 R2 U L2 U L2 U' L2 F2 D' R2 D' B2 R2 D\n"
		"D2 R2 U L2 U L2 D' B2 L2 D' F2 U' B2 R2 D\n"
		"D2 R2 D F2 U F2 D' L2 F2 D' R2 D' B2 R2 D\n"
		"B2 U' L2 U' F2 U B2 U' L2 D' L2 D F2 R2 D2\n"
		"B2 D' B2 U' L2 U R2 U' B2 U' L2 D F2 R2 D2\n"
		"B2 D' B2 U' L2 D B2 U' L2 U' F2 U F2 R2 D2\n"
},
[13] = {
	.scramble = "R2 F2 D2 L2 B2 D B2 R2 B2 R2 U R2 U' R2",
	.solutions =
		"F2 L2 D' R2 B2 D' R2 U F2 D2 R2 F2 R2 F2\n"
		"B2 L2 D' L2 F2 D' L2 U F2 U2 R2 B2 L2 F2\n"
		"L2 U F2 D' R2 D F2 B2 U' F2 U' L2 U2 B2\n"
		"L2 D R2 D' B2 D R2 L2 U' R2 D' L2 U2 B2\n"
		"L2 B2 L2 B2 U' L2 U L2 F2 B2 U' L2 U2 B2\n"
		"R2 U R2 U' R2 B2 R2 B2 D' B2 L2 D2 F2 R2\n"
},
[14] = {
	.scramble = "U2 F2 U' F2 R2 D R2 U2 F2 U R2 U' R2 D'",
	.solutions =
		"R2 U' F2 U' F2 D F2 B2 L2 U R2 D R2 B2\n"
		"B2 L2 U L2 F2 U' F2 U F2 L2 D' L2 U' B2\n"
		"R2 D' L2 D' R2 F2 R2 U L2 B2 D' R2 F2 U\n"
		"U F2 U F2 U' L2 U2 F2 D' F2 L2 D F2 U2\n"
		"U F2 D R2 D B2 U2 R2 D F2 L2 D F2 U2\n"
		"D R2 U R2 U' F2 U2 R2 D' R2 F2 U F2 U2\n"
		"D R2 U R2 D' L2 U2 F2 D' F2 L2 D F2 U2\n"
		"D R2 D B2 D L2 U2 B2 D R2 F2 U F2 U2\n"
		"D R2 U R2 U' F2 D2 L2 D' L2 B2 U B2 D2\n"
},
[15] = {
	.scramble = "U' R2 U B2 D' F2 D' B2 D L2 B2 U L2 D' B2",
	.solutions =
		"B2 D L2 U' B2 L2 D' B2 D F2 D B2 U' R2 U\n"
		"B2 D L2 D' R2 B2 U' B2 U L2 D R2 U' F2 D\n"
},
[16] = {
	.scramble = "U L2 U' F2 D2 L2 F2 B2 D' R2 B2 U2 B2 U' F2",
	.solutions =
		"B2 D L2 F2 D' R2 F2 U2 B2 U' L2 U R2 U2 B2\n"
		"L2 B2 U' F2 U' B2 U2 L2 U L2 U' B2 L2 U2 R2\n"
		"F2 U B2 U' B2 D R2 F2 B2 D' L2 D' F2 U L2\n"
		"F2 U B2 D' R2 D F2 R2 L2 D' B2 D' L2 D L2\n"
		"F2 D L2 U' L2 U R2 F2 B2 D' L2 D' F2 U L2\n"
		"F2 D L2 U' L2 D B2 R2 L2 U' R2 U' L2 D L2\n"
		"F2 D L2 D' B2 U F2 R2 L2 U' L2 D' F2 U L2\n"
		"F2 U B2 U2 B2 R2 U' L2 U2 R2 L2 B2 D' L2 U'\n"
		"F2 U B2 U2 B2 R2 D F2 B2 L2 D2 F2 U L2 U'\n"
		"F2 U' F2 D2 L2 D' F2 D2 R2 F2 B2 U' R2 B2 U'\n"
		"F2 U B2 L2 U2 B2 R2 D' B2 D2 F2 L2 D' F2 D'\n"
		"F2 U B2 L2 D2 F2 L2 D' F2 U2 F2 L2 D' F2 D'\n"
		"F2 U' F2 U2 R2 U' L2 U2 B2 R2 L2 U' B2 L2 D'\n"
		"F2 U' F2 D2 L2 U' R2 D2 B2 R2 L2 U' B2 L2 D'\n"
},
[17] = {
	.scramble = "L2 U B2 U2 F2 L2 U' B2 U2 F2 R2 D' B2 U'",
	.solutions =
		"U B2 D R2 F2 U2 B2 U L2 F2 U2 B2 U' L2\n"
		"U B2 D R2 F2 D2 F2 U R2 B2 D2 B2 U' L2\n"
},
[18] = {
	.scramble = "U R2 D' L2 B2 U' R2 U L2 U' R2 B2 D L2",
	.solutions =
		"U L2 U F2 U2 F2 R2 U B2 R2 D F2 D2 B2\n"
		"U F2 L2 D R2 U2 R2 B2 D F2 D B2 U2 B2\n"
		"U' L2 D' B2 U2 L2 D R2 U F2 B2 D2 R2 B2\n"
		"U' L2 D' B2 D2 R2 D L2 U F2 B2 U2 R2 B2\n"
		"D R2 F2 D B2 U2 B2 L2 U F2 D B2 U2 B2\n"
		"D R2 F2 D B2 L2 D2 F2 R2 U' B2 D' B2 U2\n"
		"L2 D' B2 R2 U L2 U' R2 U B2 L2 D R2 U'\n"
		"L2 U' L2 B2 U F2 U' B2 U L2 F2 D B2 D'\n"
},
[19] = {
	.scramble = "U' L2 B2 U R2 L2 U2 L2 D' B2 L2 B2 U L2",
	.solutions =
		"D R2 D R2 U2 R2 D R2 B2 L2 F2 R2 U' B2\n"
		"D R2 D R2 U2 R2 D L2 F2 L2 B2 L2 U' B2\n"
		"D2 R2 F2 D2 L2 F2 U2 L2 D R2 D' F2 R2 B2\n"
		"L2 B2 L2 D2 B2 D' R2 D R2 D2 F2 R2 D2 B2\n"
		"F2 U2 R2 F2 D R2 F2 D R2 F2 D' B2 U' R2\n"
		"L2 U' B2 L2 B2 D L2 U2 R2 L2 U' B2 L2 U\n"
		"L2 U' B2 L2 B2 U B2 U2 F2 B2 U' R2 B2 D\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
