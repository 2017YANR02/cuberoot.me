struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "R' F2 L U' L D2 R' D' B2 R' U2 F2 L' B2 R2 D2 L D2 F2 B2 R'",
	.solutions =
		"(R' L2 U L2 D' L F2 R)\n"
		"(B2 U R D' L' U' B2 R)\n"
		"(R' L2 U L2 D' R U2 L)\n"
},
[1] = {
	.scramble = "L' U L D R L' U R D2 R U2 D2 B2 L' U2 B2 L D2 B2 R'",
	.solutions =
		"R2 L D F2 B2 L D2 R\n"
		"R2 L D F2 B2 R F2 L\n"
},
[2] = {
	.scramble = "R' L' U L' D' R' D L' D' R2 U' D' F2 R2 B2 L2 U2",
	.solutions =
		"R U F2 R2 L B2 U L\n"
		"(R' L2 D L U L2 D R)\n"
		"(R' L2 D L' D L2 U R)\n"
		"(R' L' U L' D L' D R)\n"
		"(R' L' U L' D' R' D L)\n"
},
[3] = {
	.scramble = "R D2 L2 D F2 B2 U' R' U2 L2 D' F2 U2 L2 U L2 U F2",
	.solutions =
		"(R' L2 U R2 L2 D L)\n"
},
[4] = {
	.scramble = "U' B2 U' L2 F2 L' U' R F2 D2 R U2 B2 L F2 D2 L D2 R' D2",
	.solutions =
		"R2 B2 L' U2 F2 D' R\n"
		"R' U R B2 U' D' R\n"
		"L D2 B2 R2 L2 D' R\n"
		"R2 B2 L' D2 B2 D' L\n"
		"R' U R F2 U' D' L\n"
		"L U2 F2 R2 L2 D' L\n"
		"(U B2 R' D' F2 B2 L)\n"
},
[5] = {
	.scramble = "U L' F2 D' R2 U R F2 B2 R2 U R2 D L2 U' R2 D2 F2 B2",
	.solutions =
		"U2 B2 D' L' U B2 R\n"
		"U2 F2 U' R' D B2 L\n"
		"R D R' U R2 B2 L\n"
		"R D R' U L2 F2 L\n"
		"(U L' F2 D' R2 U R)\n"
},
[6] = {
	.scramble = "U2 B2 U R' L' U R2 U' R B2 R2 D' R2 D2 L2 B2 D' B2 L2 U",
	.solutions =
		"U B2 R' L' D F2 D R\n"
		"D2 B2 D' R U' F2 B2 R\n"
		"L2 U' R' L2 U F2 D2 R\n"
		"U D B2 L U F2 D' L\n"
		"L2 U' R' L2 U B2 U2 L\n"
},
[7] = {
	.scramble = "R L2 B2 L' F2 R' U' F2 R' D2 F2 R' U2 L' D2 F2 U2",
	.solutions =
		"(B2 R U2 R' F2 R)\n"
		"(B2 R' F2 R U2 R)\n"
		"(B2 L F2 L' F2 R)\n"
		"(B2 L' U2 L U2 R)\n"
		"(B2 R U2 L' U2 L)\n"
		"(B2 R' F2 L F2 L)\n"
		"(B2 L F2 R' D2 L)\n"
		"(B2 L' U2 R B2 L)\n"
},
[8] = {
	.scramble = "U R U' B2 U' F2 R' U2 L' U R2 L2 U F2 U' B2 D' B2 D B2 L2 D",
	.solutions =
		"U' L U' R' U' F2 B2 R\n"
		"D L U' D L B2 U L\n"
		"D B2 U2 L U L2 U L\n"
		"D B2 U2 L' U L2 U L\n"
},
[9] = {
	.scramble = "U' B2 U' R2 D' L2 B2 R' B2 D2 R2 F2 U L2 U' L2 D2 F2 U R2 D'",
	.solutions =
		"R' L2 D L' D2 R\n"
		"R' L2 D R' B2 L\n"
},
[10] = {
	.scramble = "U L' B2 R' U' D R U F2 R D2 L' F2 R' F2 D2 F2 D2 R",
	.solutions =
		"D' L' U' R' B2 U D2 R\n"
		"(D F2 R D F2 L' B2 R)\n"
		"(R2 L2 U R F2 U2 D R)\n"
		"(D F2 R D F2 R' U2 L)\n"
},
[11] = {
	.scramble = "B2 R D2 L' U' L U' L U' R2 D2 R2 B2 U B2 U2 F2 U' R2",
	.solutions =
		"D' L' U2 B2 U' D2 R\n"
		"L' D F2 U' L B2 R\n"
		"D' L' D2 F2 U' D2 L\n"
		"L' D F2 U' R D2 L\n"
},
[12] = {
	.scramble = "U2 L' F2 U' F2 R' U R' B2 R D2 F2 L' D2 R2 F2 R B2 R'",
	.solutions =
		"U2 R2 L' U L D2 R\n"
		"L2 D2 L U L D2 R\n"
		"U2 R2 L' U R F2 L\n"
		"L2 D2 L U R F2 L\n"
		"L' U D R D' F2 L\n"
},
[13] = {
	.scramble = "F D2 L U2 R2 L B R F2 D2 R F2 D2 F2 R' L' F2 L U2",
	.solutions =
		"(D' L D L' U2 R D R)\n"
},
[14] = {
	.scramble = "U R' D2 R' D2 B2 U' L U2 B2 U F2 D2 L2 B2 R2 F2 U' D2 F2",
	.solutions =
		"U2 D' L U' F2 D2 R\n"
		"U2 D' L U' B2 U2 L\n"
},
[15] = {
	.scramble = "R2 B2 D' R L D F2 D F2 B2 D2 L B2 R' D2 L' U2 R2 D2 L",
	.solutions =
		"(U2 R' D' R' D F2 U R)\n"
		"(D2 L' D' L U R2 D L)\n"
		"(D2 L' D' L' U R2 D L)\n"
},
[16] = {
	.scramble = "R' U2 F2 B2 L' F2 D' R U' F2 R2 L2 D' F2 U F2 R2 L2 B2 D",
	.solutions =
		"D2 L' F2 D R' B2 R\n"
		"D2 L' B2 U R' U2 R\n"
		"D2 L' F2 D L' D2 L\n"
		"D2 L' B2 U L' B2 L\n"
},
[17] = {
	.scramble = "R' L2 U F2 L' D' R' L U' D2 B2 U2 L2 F2 L2 B2",
	.solutions =
		"L' U' L2 D' F2 L' D2 R\n"
		"U2 R U' D2 R D B2 L\n"
		"U' L D' R' D B2 D' L\n"
		"L' U' L2 D' F2 R' B2 L\n"
		"(D2 F2 R2 L U' L' F2 R)\n"
		"(D' B2 R' L2 D' R' B2 R)\n"
		"(D2 F2 R2 L U' R' D2 L)\n"
		"(D' R' L' U R2 U D2 L)\n"
		"(D' R' L' U' D2 L2 U' L)\n"
		"(D' B2 R' L2 D' L' D2 L)\n"
		"(D' B2 R' L' D L2 D' L)\n"
		"(R' L2 U F2 L' D R L)\n"
		"(R' L2 U F2 L' D' R L)\n"
},
[18] = {
	.scramble = "B2 R D R' U2 L U B2 L2 D2 R2 L2 F2 B2 D R2 D' B2",
	.solutions =
		"(B2 R D L' B2 R)\n"
		"(B2 R D R' U2 L)\n"
},
[19] = {
	.scramble = "U' R2 F2 U R D L' D2 F2 R F2 L U2 L2 B2 D2 L U2 F2",
	.solutions =
		"D2 L2 F2 R B2 U' R\n"
		"D2 F2 D2 R B2 U' R\n"
		"D2 F2 U2 L F2 U' L\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
