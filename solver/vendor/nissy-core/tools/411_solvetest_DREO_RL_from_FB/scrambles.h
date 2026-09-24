struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "R' U L B2 D2 R2 U' R' D' B2 D F2 B2 D R2 F2 R2 B2 D2 L2",
	.solutions =
		"U2 R' D R2 L U\n"
		"D2 L' D R L2 U\n"
},
[1] = {
	.scramble = "L' B2 L2 F2 U R U B2 L2 F2 D2 F2 D2 L2 U' R2 F2 D' R2",
	.solutions =
		"U L U L B2 D2 L' U\n"
		"U L U' R D2 F2 R' U\n"
		"U2 L2 D2 L F2 D L2 U\n"
		"U' R2 L F2 R' U B2 U\n"
		"U' R' U2 R2 L U B2 U\n"
		"R L F2 R' B2 D F2 U\n"
		"R2 U' B2 D2 L2 F2 R' U\n"
		"R2 F2 U2 L' B2 D L2 U\n"
		"R2 B2 D2 R' B2 D B2 U\n"
		"R2 B2 L2 D R2 U2 R U\n"
		"R2 B2 L2 D' L2 D2 R' U\n"
		"R' F2 U2 L' F2 D B2 U\n"
		"L2 D2 R2 L F2 D L2 U\n"
		"U2 L2 D2 L F2 U B2 D\n"
		"U' R2 L F2 R' D L2 D\n"
		"U' R' U2 R2 L D L2 D\n"
		"R L F2 R' B2 U L2 D\n"
		"R2 U' B2 D2 R2 B2 R' D\n"
		"R2 F2 U2 L' B2 U B2 D\n"
		"R2 F2 R2 U L2 D2 L D\n"
		"R2 F2 R2 U' R2 U2 L' D\n"
		"R2 B2 D2 R' B2 U R2 D\n"
		"R' F2 U2 L' F2 U R2 D\n"
		"L U2 L U' F2 U2 R' D\n"
		"L2 D2 R2 L F2 U B2 D\n"
		"(R2 L U' R2 U2 F2 R D)\n"
},
[2] = {
	.scramble = "U' L2 D' R' U2 R U' R F2 U' F2 U' F2 R2 L2 U2 R2 D R2 U R2",
	.solutions =
		"(D R' D' U2 F2 R D)\n"
},
[3] = {
	.scramble = "R U B2 U F2 L2 D2 R U F2 L2 U2 D' F2 L2 D' R2 D2 R2",
	.solutions =
		"U' B2 D' L B2 R' U\n"
		"F2 R' F2 L U2 R' U\n"
		"B2 L' D L U' R2 U\n"
		"U2 L U2 F2 B2 L' D\n"
		"U2 B2 D' L' F2 R' D\n"
		"F2 U2 L' U2 B2 L' D\n"
		"F2 R B2 L D2 R' D\n"
		"F2 B2 D2 R D2 L' D\n"
		"B2 D2 R' D2 F2 L' D\n"
		"B2 L' D L D' F2 D\n"
		"B2 L' F2 R U2 R' D\n"
		"(R2 F2 U B2 U2 R' U)\n"
},
[4] = {
	.scramble = "R D R' L D' B2 U' F2 U2 L B2 D2 L' U2 R' B2 D2 F2 R",
	.solutions =
		"R2 U L D' R B2 D\n"
		"(R D R' L D' B2 U)\n"
		"(R D R' L U' L2 D)\n"
},
[5] = {
	.scramble = "D R' U R' F2 L' B2 U' D2 F2 B2 R2 F2 R' B2 R' U2 D2 R2",
	.solutions =
		"U' B2 L2 D' L' F2 U\n"
		"L' D2 R2 D R' L' D\n"
		"L' D2 R2 D' R' L' D\n"
		"(F2 L D R U2 L D)\n"
		"(F2 L D' R U2 L D)\n"
},
[6] = {
	.scramble = "F2 B2 L U R D L' F2 U B2 R2 D' L2 D B2 D' L2 U' R2 B2",
	.solutions =
		"R U R2 U F2 R L U\n"
		"R2 F2 R' U L' D' R2 U\n"
		"R2 B2 L' D R' D' B2 U\n"
		"R' U F2 R2 U' R' L U\n"
		"L' U' L F2 U' R' L U\n"
		"L' D' U' F2 R' U2 R' U\n"
		"L' B2 R' D R2 B2 R' U\n"
		"F2 U' R' L' F2 D L2 U\n"
		"B2 D' R' L' F2 D B2 U\n"
		"R U R2 U B2 R L D\n"
		"R2 F2 R' U L' U' B2 D\n"
		"R2 B2 L' D R' U' L2 D\n"
		"R' U B2 L2 D' R L' D\n"
		"L' U' L B2 D' R L' D\n"
		"L' B2 R' D L2 F2 R' D\n"
		"F2 U' R' L' F2 U B2 D\n"
		"B2 D' R' L' F2 U R2 D\n"
		"(R2 D' R L' U F2 R2 U)\n"
		"(R2 D' R L' D L2 F2 U)\n"
		"(R2 D' R' L U R2 F2 U)\n"
		"(R2 D' R' L D F2 L2 U)\n"
		"(U2 R B2 U R B2 R' D)\n"
		"(R2 D' R L' U B2 L2 D)\n"
		"(R2 D' R L' D R2 B2 D)\n"
		"(R2 D' R' L U L2 B2 D)\n"
		"(R2 D' R' L D B2 R2 D)\n"
		"(R' L' F2 U' L' F2 L D)\n"
},
[7] = {
	.scramble = "D2 F2 D R2 D' B2 R L2 D L2 B2 U' B2 D2 B2 L2 U' L2 F2",
	.solutions =
		"(U2 R U L2 U' R2 U)\n"
		"(U2 R D F2 D' R2 U)\n"
		"(B2 R B2 U R' L U)\n"
		"(U2 R U L2 D' F2 D)\n"
		"(U2 R D F2 U' B2 D)\n"
		"(B2 R F2 D R L' D)\n"
},
[8] = {
	.scramble = "L U' R F2 U2 D2 R U L2 B2 U2 R2 D F2 U B2 R2 U2",
	.solutions =
		"U2 L' F2 R2 U' R2 L' U\n"
},
[9] = {
	.scramble = "L F2 D L' B2 D B2 R' U2 F2 D R2 D2 F2 B2 U B2 D B2 R2",
	.solutions =
		"(F2 D' F2 U2 B2 R L2 U)\n"
		"(R2 B2 U L2 D2 B2 L D)\n"
		"(R2 B2 U' F2 R2 U2 L' D)\n"
		"(F2 D' R2 B2 D2 B2 L D)\n"
},
[10] = {
	.scramble = "L U' R B2 U2 R D' R U2 R F2 R2 B2 U2 L' B2 R F2 L",
	.solutions =
		"(L U' R B2 U2 R D)\n"
},
[11] = {
	.scramble = "D2 R2 D F2 D' L U2 D' L D2 R D2 L F2 L2 B2 R' U2",
	.solutions =
		"(D2 R2 D U' R U)\n"
},
[12] = {
	.scramble = "D2 F2 U' F2 D' F2 B2 R U' B2 D R2 U B2 U R2 D B2 D B2 U'",
	.solutions =
		"D R' D F2 R2 L U\n"
},
[13] = {
	.scramble = "R2 U2 D' L B2 R2 D R B2 U2 L D2 B2 R' F2 L' F2 B2 R'",
	.solutions =
		"(U2 R2 D F2 U R U)\n"
		"(U2 R2 D' F2 U R U)\n"
		"(U2 F2 U' R B2 L2 U)\n"
		"(U2 B2 D' L F2 L2 U)\n"
		"(D2 L2 U R2 D L U)\n"
		"(R2 D' U2 L F2 L2 U)\n"
		"(U2 R2 D B2 D L D)\n"
		"(U2 R2 D' B2 D L D)\n"
		"(U2 R' D' R' B2 L D)\n"
		"(U2 F2 U' R F2 R2 D)\n"
		"(U2 B2 D' L B2 R2 D)\n"
		"(D2 L2 U L2 U L D)\n"
		"(R2 D' U2 L B2 R2 D)\n"
},
[14] = {
	.scramble = "U D F2 L2 U' R2 L U R' B2 R' D2 R' B2 R2 D2 R' F2 R'",
	.solutions =
		"(U2 L2 B2 D' R L2 U)\n"
},
[15] = {
	.scramble = "L' U' R' D2 R' D' L2 U' R2 L2 B2 D2 R2 F2 U2 R' F2 R' B2 U2",
	.solutions =
		"U L D' U2 R' F2 R U\n"
		"U B2 L' U F2 U L U\n"
		"U B2 L' U' F2 U L U\n"
		"U' B2 L D' L2 F2 L U\n"
		"D R2 B2 R U' L' F2 U\n"
		"D R2 B2 R' U' L' F2 U\n"
		"D' R' L2 D' L U' F2 U\n"
		"R' U B2 U L' U' F2 U\n"
		"U B2 L' U B2 D R D\n"
		"U B2 L' U' B2 D R D\n"
		"U2 R' U2 L' D R' L2 D\n"
		"U' B2 L D' R2 B2 L D\n"
		"D' R' L2 D' L D' L2 D\n"
		"R' U B2 U L' D' L2 D\n"
		"R' L' D' R2 L' D2 L' D\n"
		"R' L' D' L U2 R2 L D\n"
		"U B2 D R F2 R D U\n"
		"U B2 D R F2 R' D U\n"
		"U B2 D L D2 L D U\n"
		"U B2 D L D2 L' D U\n"
		"(L' U' R' D2 R' D' L2 U)\n"
		"(L' U' R' D2 R' U' F2 D)\n"
},
[16] = {
	.scramble = "F2 R' F2 U F2 R2 L F2 U' R2 F2 U2 F2 U' R2 L2 F2 L2",
	.solutions =
		"D2 R2 B2 R' B2 U\n"
},
[17] = {
	.scramble = "R2 L' F2 L' D' R2 F2 R L2 D' R2 U F2 R2 U2 L2 U' L2 U",
	.solutions =
		"U L' D R D2 B2 R' U\n"
		"U L' D2 B2 R D' R2 U\n"
		"U L' D' L B2 U2 L' U\n"
		"U2 R2 L2 D L U2 F2 U\n"
		"U2 R2 L2 D L D2 B2 U\n"
		"U2 R2 L2 D' B2 U2 R' U\n"
		"U2 F2 R' D' B2 R L U\n"
		"U' L U' R2 L2 D' B2 U\n"
		"U' L D' F2 B2 U' B2 U\n"
		"D U R2 U2 L2 F2 L U\n"
		"D2 B2 D' U' L2 F2 L U\n"
		"B2 L U' L F2 D' L U\n"
		"U L' D2 B2 R U' B2 D\n"
		"U2 F2 R' D' F2 R L D\n"
		"U' R2 D B2 R2 U2 L D\n"
		"U' L U' R2 L2 U' L2 D\n"
		"U' L D' F2 B2 D' R2 D\n"
		"U' F2 L2 U' F2 U2 L D\n"
		"D U R2 U2 R2 B2 L D\n"
		"D2 B2 D' U' R2 B2 L D\n"
		"L F2 R U R' U2 F2 D\n"
		"L F2 R U R' D2 B2 D\n"
		"L F2 R U' F2 D2 L D\n"
		"F2 R D' R F2 U' R D\n"
		"(R U2 F2 D L U2 F2 U)\n"
		"(R U2 F2 D L D2 B2 U)\n"
		"(R U2 F2 D' B2 U2 R' U)\n"
		"(R D2 B2 D' F2 D2 R' U)\n"
		"(R F2 D' U B2 R' L2 U)\n"
		"(R F2 L2 D U' R2 L' U)\n"
		"(R B2 D U' B2 R2 L' D)\n"
		"(R B2 R2 D' U R' L2 D)\n"
		"(R' D U' R' L' U2 R' D)\n"
},
[18] = {
	.scramble = "F2 L' F2 R B2 U' F2 D L2 F2 U2 R B2 L' D2 L' D2 F2 R'",
	.solutions =
		"U' L2 D U R L2 D\n"
		"D U2 F2 U2 R L2 D\n"
		"D L2 U2 F2 U2 R D\n"
		"D L2 F2 U2 F2 R D\n"
		"D B2 D2 B2 R L2 D\n"
},
[19] = {
	.scramble = "R2 U' L U' F2 R2 D' R2 L U R2 U2 R2 F2 L2 F2 U L2 B2 D'",
	.solutions =
		"U2 F2 D' R' L2 D\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
