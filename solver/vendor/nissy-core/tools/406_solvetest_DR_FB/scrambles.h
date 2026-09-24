struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "L D' F R' F' B L F U2 R2 D2 R2 F2 R2 L U2 F2 R U2",
	.solutions =
		"(L D F' D2 L U2 F' R)\n"
		"(L D F' U2 R U2 B' L)\n"
},
[1] = {
	.scramble = "L F R B2 L2 D B R2 L F L2 D2 B R2 F2 U2 D2 F U2 F2 R2",
	.solutions =
		"(L F R B2 L2 D B L)\n"
},
[2] = {
	.scramble = "F U' F2 R2 L' F' U' D2 L' D2 B2 R2 D2 B2 L2 U2 B2 D' F2 B2 R2",
	.solutions =
		"(U2 R L U R F B' D)\n"
},
[3] = {
	.scramble = "D R L2 F' B R D2 B' U' R D2 R B2 D2 L' F2 U2 R2 L",
	.solutions =
		"R' L B L' D L2 D' B2 R\n"
		"D' U2 R' U' R U' B' D' L\n"
		"B' U' L F2 U2 R' B' R2 U\n"
		"(L2 D' F' U2 F2 D' R2 F2 R)\n"
		"(L2 D' F' U2 F2 D' L2 B2 R)\n"
},
[4] = {
	.scramble = "D' B L' F2 L' F' B U' R' F2 B' U2 F2 U L2 B2 D' F2 D2 L2 U L2",
	.solutions =
		"(B D R2 D2 U' R F2 B' D)\n"
},
[5] = {
	.scramble = "U' B R U2 F' D2 L U B2 L D2 L2 U2 R2 F2 U R2 D' F2 U' B2",
	.solutions =
		"L' B' D' F B' L D2 U' R\n"
		"D' F R' B' U F' U B' L\n"
		"(F D U R' B2 R2 F R' D)\n"
},
[6] = {
	.scramble = "U' D' F' R B' L2 F2 U B' R' L F2 U2 D2 R' B2 U2 R U2 L",
	.solutions =
		"R2 L' D' B' U L D' L F2 R\n"
		"B R2 B' D2 L' D B' U F' R\n"
		"U' R' U F2 B D R D2 U' L\n"
		"R2 L' D' B' U L D' R U2 L\n"
		"R2 F2 R B' D U' B' L B' L\n"
		"R2 B2 L B D2 L B2 D' L' U\n"
		"D U2 B' L2 F' U L' D' B' D\n"
		"D2 L2 B' R2 U R' B R2 F' D\n"
		"D' F R2 B' L2 U' F' R' F' D\n"
		"R' F' R F' R B' L2 U' R' D\n"
		"(F2 B' U2 R B D' U F' D2 R)\n"
		"(U F' D' F B2 L' F' U B U)\n"
		"(U F' R2 D2 F2 R2 B' D2 L U)\n"
		"(U' R D' B L' F2 B2 D2 R U)\n"
		"(U' F2 R D F' B2 U R2 F' U)\n"
		"(U' F2 R F U2 B' U2 B' L2 U)\n"
		"(D R2 D' R2 F L2 F D R U)\n"
		"(D2 U B2 L U' B' L2 D B U)\n"
		"(F R' F2 L2 B2 R D R F U)\n"
		"(F B2 U' B2 R' F L2 F R2 U)\n"
		"(F2 B R2 D F R2 B' R F2 U)\n"
		"(B' U2 L2 U F' L2 F2 B R U)\n"
		"(U R' L2 D2 B L2 B U2 R D)\n"
		"(U' F2 R B L2 B' L2 F' R2 D)\n"
		"(U' F' D' F' D2 R' F' D B D)\n"
		"(U' B D2 U2 B2 U2 B U2 L D)\n"
		"(D2 R2 F U' F D2 F2 B R D)\n"
		"(R F D2 R' B' U L' B' L' D)\n"
		"(R2 F R F' L2 B2 U' R F' D)\n"
		"(F R2 F' R' F L2 U' R F' D)\n"
		"(B' L2 U B D2 F B2 L F2 D)\n"
},
[7] = {
	.scramble = "F U B' R2 D' L' F2 U R' L' D B2 D F2 U2 F2 L2 D B2 U' B2 D",
	.solutions =
		"(D' L D2 F U R F D)\n"
},
[8] = {
	.scramble = "F' B R2 L' F' U2 B' L' U R B2 U2 R2 U D2 L2 U L2 F2 L2",
	.solutions =
		"R B2 U2 F' R L2 F2 U' L\n"
		"U R' D L2 U B' R L U\n"
		"F R' D' F2 U2 B2 R' B' D\n"
		"(F' U2 L' U B U' F' U R)\n"
		"(B L B' D2 R' F' L D R)\n"
		"(R2 B2 D2 B' R2 B' R' U L)\n"
		"(F' U F2 R2 D2 F' R D L)\n"
		"(B R' B' R D2 B2 R U L)\n"
		"(D R D B' D2 B' U R L)\n"
		"(D R D B' D2 B' U' R L)\n"
},
[9] = {
	.scramble = "D B U2 B2 R' L' D' R' U F B2 R2 D2 L2 F R2 F2 B L2 F R2",
	.solutions =
		"(D F2 B' U2 R' L D R' U)\n"
		"(D B U2 B2 R' L' D' R' U)\n"
		"(D B' R' L D2 F2 D R' U)\n"
		"(R F2 D U2 B L2 U2 R' D)\n"
},
[10] = {
	.scramble = "R' L2 D' F' L B L F' U2 L' D2 B2 D2 F2 R2 D' R2 D B2 D F2",
	.solutions =
		"(U2 R' F' B L' U' B2 D' R)\n"
},
[11] = {
	.scramble = "F' U' R2 F U' B U' R D' B U2 D2 F2 R2 F U2 F' L2 B' L2 D2",
	.solutions =
		"D2 F' L2 D R' U F B D\n"
		"D2 F' L2 D R' U' F B D\n"
		"(U' B' D' F2 D' L' D' F U)\n"
		"(F' U' R2 F U' B U' R D)\n"
		"(B L2 D F' U' L2 D R D)\n"
},
[12] = {
	.scramble = "U2 R' U2 D2 B' L D B2 R B L2 B2 U2 B2 U D2 B2 D B2 D'",
	.solutions =
		"(D2 U L2 D R F L' U2 R)\n"
		"(U2 F2 U B R B' D B L)\n"
		"(D2 U L2 D R F R' F2 L)\n"
		"(L2 D R' B2 U2 F' B2 L' U)\n"
},
[13] = {
	.scramble = "L' U2 F2 B' U' R D B' U' F2 U2 F' R2 U2 F L2 F U2 B2 L2 U2 D2",
	.solutions =
		"(B2 L' F R F2 D F' U' R)\n"
		"(L' U2 F2 B' U' R D B' U)\n"
},
[14] = {
	.scramble = "B2 U' B D R U2 F R' D2 F R B2 U2 L U2 R' B2 U2 R F2 R U2",
	.solutions =
		"R2 D' B R L2 B' L' U' F L\n"
		"F D2 U' F R' B L D L2 U\n"
		"F D2 L2 F R B L' D' F' U\n"
		"F D2 U' F R' B L U B2 D\n"
		"(U L' F' L2 D' F' B2 L U' R)\n"
		"(F B' L2 F D B' U' L' B' R)\n"
		"(F2 D R B R2 U' R' D2 F2 R)\n"
		"(F2 D R B R2 U' L' B2 D2 R)\n"
		"(F2 L2 B U' B' D' F L' F' R)\n"
		"(F2 B2 U2 B D B' U L' B' R)\n"
		"(F2 B' D B' U' L' B2 L2 B R)\n"
		"(U F R2 U F' D U R B L)\n"
		"(R2 D U2 F' U' L F R B' L)\n"
		"(R2 D U2 F' U' L F' R B' L)\n"
		"(R2 D' U2 F' U B' R' F B' L)\n"
		"(L' D2 B2 L' D U R F' D L)\n"
		"(F2 D R B U B2 U' R2 U L)\n"
		"(F2 D R B R2 U' R' U2 B2 L)\n"
		"(F2 D R B R2 U' L' F2 U2 L)\n"
		"(D R B' U L' B' D2 B' L2 U)\n"
		"(D B2 L B' R L' U L B U)\n"
		"(B' D R L F U B U2 R U)\n"
		"(D R B U B2 L' F' D' F' D)\n"
		"(F L' B' R F B' U R L' D)\n"
		"(F2 R B D U' F2 R F' B2 D)\n"
		"(B2 U R' L' D' B2 U2 B L D)\n"
},
[15] = {
	.scramble = "U2 F U2 L F2 U2 R2 D L F2 D2 F R2 U2 L2 U2 B U2 B U2 L2",
	.solutions =
		"R' F' L U' L D2 R\n"
		"R' F' L U' R F2 L\n"
},
[16] = {
	.scramble = "L' F U' R2 F U2 B U2 L' U' F2 U2 L2 D2 R U2 B2 D2 L2 D2",
	.solutions =
		"U R' U' F L' F' D' R' F2 R\n"
		"R' F D U L F' B2 L2 D' R\n"
		"R' F2 R2 L' F D U2 R2 U' R\n"
		"R' F2 R2 L' F D' L2 D2 U R\n"
		"L' U2 F R' D2 L2 D' B2 U R\n"
		"U R' U' F L' F' D' L' U2 L\n"
		"R' L' F' D R2 F R' U R' U\n"
		"L B R U' F' D2 F2 L B' U\n"
		"R' B2 L' F U L D B2 L' D\n"
		"L' F R F' U R2 U' F' R D\n"
		"(D2 F L B D' L' F R' D' L)\n"
		"(F L B L' D L2 U' R U' L)\n"
		"(D U' L F R' U' B D' L U)\n"
		"(F2 L D F B' R' L' F L' U)\n"
		"(L B L' F' D' F2 L D R' D)\n"
		"(L B L' F' D' F2 L' D R' D)\n"
},
[17] = {
	.scramble = "D F' B D' B' U' L2 B' U' R' L2 B2 U' B2 D F2 U' L2 F2 U2 B2 D'",
	.solutions =
		"D' F' R B' R2 U R' D B2 U\n"
		"R F L2 B' L2 D R2 B2 R' U\n"
		"R F2 U2 F' D' L' D L2 B U\n"
		"R B2 D' R' D2 R2 F D' B' U\n"
		"L2 U' B2 D L' F' B' D F2 U\n"
		"L2 F' D' R B' D2 R' F2 R2 U\n"
		"D' R2 D2 F U' F L' F' B D\n"
		"D' F' R B' R2 U R' U R2 D\n"
		"R F L2 B' L2 D L2 F2 R' D\n"
		"R B2 D' R' F D2 B U' F' D\n"
		"R B2 D' R' B R2 F U' F' D\n"
		"R B' D' F2 U F' D F2 R' D\n"
		"R2 U B2 R' U' F U B' R2 D\n"
		"L2 U' B2 D L' F' B' U L2 D\n"
		"L2 F' D' R B' D2 R' B2 L2 D\n"
		"B D U2 F' L U2 B' L2 B D\n"
		"(L' F2 D' U2 B R2 U R' B' R)\n"
		"(U R2 F' D' L' D' L' D2 U' L)\n"
		"(U R' D2 U R F' L F R2 U)\n"
		"(U' R2 F' U' L' D2 B R2 B2 U)\n"
		"(D F' L B2 D2 R B D' F' U)\n"
		"(D' R2 B D F2 B' D F L' U)\n"
		"(D' F2 R2 D L2 B' L' F' B U)\n"
		"(R2 B2 D' F D' F2 U2 R' F U)\n"
		"(F U' F' U' L' D2 B D R2 U)\n"
		"(U F2 R2 U' R2 F L' F B' D)\n"
		"(U' R2 F' U' L' D2 B L2 F2 D)\n"
		"(D L F U2 L' D' B U' F D)\n"
		"(D L F U2 L' D' B' U' F D)\n"
		"(D L2 U2 L2 F L' F' U' B' D)\n"
		"(D F' L F2 U2 L B U' F' D)\n"
		"(D' R2 D2 F L' F' R2 U' B' D)\n"
		"(F U' F' U' L' D2 B U F2 D)\n"
},
[18] = {
	.scramble = "D' R D2 F' R2 B2 R B U' R2 L2 F U2 D2 F L2 U2 B' D2",
	.solutions =
		"(D' R B D2 F' R2 U F R)\n"
		"(D R' F D' B' L2 D' B L)\n"
		"(D' R D2 F' R2 B2 R B U)\n"
		"(D' R F' D2 R2 B2 R B U)\n"
		"(D' R B D2 F' B' R' B U)\n"
},
[19] = {
	.scramble = "R2 B U F D R' F2 B D B U2 R2 B2 R2 U' R2 F2 U D2 B2 U'",
	.solutions =
		"L' U F' U L F L' D\n"
		"F D' F' L' B' R2 B D\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
