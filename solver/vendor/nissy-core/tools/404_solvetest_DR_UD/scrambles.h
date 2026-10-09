struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "F2 D' F2 U2 R F2 R2 B' L U' L2 U' L2 U R2 U F2 U B2 R2 F2 D2",
	.solutions =
		"(F2 D' F2 U2 R F2 R2 B' L)\n"
		"(F2 D' F2 U2 R' B2 L2 B L)\n"
},
[1] = {
	.scramble = "L2 U' B' R2 D2 L U R' F U2 B' L2 U2 B L2 F' D2 F U2 L2 D2",
	.solutions =
		"F2 D2 F B' L D' R' L2 B\n"
		"F2 R2 F D B R' L' U' B\n"
		"F' R D L D' L' B L' B\n"
		"F' R D B L' U' F2 U B\n"
		"F' R' D L D' L' B L' B\n"
		"F' R' D B L' U' F2 U B\n"
		"U2 R2 D B U2 R' L2 B L\n"
		"F' R B L' B D L' U' L\n"
		"F' R' B L' B D L' U' L\n"
		"F' L B U2 D' R D' F' L\n"
		"(F2 B D R' L D2 B' L2 F)\n"
		"(F2 B D F2 R L' B' U2 F)\n"
		"(F2 B D R' L D2 F' D2 B)\n"
		"(F2 B D F2 R L' F' L2 B)\n"
},
[2] = {
	.scramble = "R F2 D2 R2 U' F B2 D' F2 R F2 R F2 U2 R U2 R' U2 B2 L D2 R",
	.solutions =
		"R U B D2 F2 L' D R L\n"
		"R U B D2 F2 L' D' R L\n"
		"(U2 F2 R' F2 R2 U' D2 F' R)\n"
},
[3] = {
	.scramble = "R2 U2 L2 U L2 F D' L2 U' R D R2 U' R2 D R2 B2 U B2 L2 D'",
	.solutions =
		"U2 R2 F' U' R' U F2 U' F\n"
		"R2 F D' B2 L' D F2 D' F\n"
		"L' F' U2 R' U' F' U2 D2 R\n"
},
[4] = {
	.scramble = "U2 F' U B R2 U2 D' L' D R' F' L2 B' R2 D2 R2 U2 B2 R2 F' L2 B' L2",
	.solutions =
		"(R2 F' R' D2 B2 U F' B D R)\n"
		"(U L' F' U' L' B' R F U' L)\n"
},
[5] = {
	.scramble = "U D R' F2 B2 D L F D' B U B2 L2 U2 R2 U' B2 D2 B2 L2 F2",
	.solutions =
		"U' D' F' D' F' L2 F B' R\n"
		"U D B' D' B' R2 F' B L\n"
},
[6] = {
	.scramble = "R' F2 R' U' F2 D2 F2 D B' R' F2 R D2 L2 B2 L2 B2 D2 L U2 L'",
	.solutions =
		"D' L U' L' D' R2 F2 D' F\n"
		"L U' L B' U D2 F R2 F\n"
		"F U D2 R B2 R' U2 R2 F\n"
		"F U R L' F2 R D2 L F\n"
		"L U' L B' U D2 B U2 B\n"
		"F U D2 R B2 R' D2 L2 B\n"
},
[7] = {
	.scramble = "D' B2 U' L B' D R2 F' R2 D2 R D2 L2 F2 U2 F2 U2 R' D2 F2 L2 F2",
	.solutions =
		"U' D F U2 D F B2 L F\n"
		"R2 U' L B L' D' R' D2 F\n"
		"U' D' F' R' F2 L2 B2 D B\n"
		"L2 D' L F L' U' R' U2 B\n"
},
[8] = {
	.scramble = "R' B U2 D F L' D' F' L U R2 B2 U2 F2 L2 U' B2 U2 B2 U' R2 D'",
	.solutions =
		"(R' B U2 D F L' D' F' L)\n"
},
[9] = {
	.scramble = "U' B R2 U2 R U' F2 D' L2 F' U2 L2 B2 R2 F2 U' D2 F2 U' L2 D",
	.solutions =
		"F L' F' B R2 B2 D B L\n"
		"(U' B' U2 R U2 B2 R U' F)\n"
		"(U' B' U2 L F2 U2 L D' B)\n"
},
[10] = {
	.scramble = "D' L2 F2 R L' F D R L U' F2 U L2 U L2 F2 U2 B2 D' B2 U2",
	.solutions =
		"R2 F2 D' L B R2 B2 D2 R\n"
		"R2 F2 D' L B L2 F2 U2 R\n"
		"R2 F2 D R F' U2 R F' L\n"
		"R2 F2 D' L B R2 F2 U2 L\n"
		"R2 F2 D' L B L2 B2 D2 L\n"
		"L' B2 D2 F L2 F2 R2 U' L\n"
		"(R B2 U' R' F2 R U' F L)\n"
		"(D' L2 F2 R L' F D R L)\n"
		"(D' L2 F2 R L' F D' R L)\n"
},
[11] = {
	.scramble = "L' D B2 D' L' B R L' B L2 U2 F2 U R2 L2 F2 D F2 U' F2 U' R2",
	.solutions =
		"(L' D B2 D' L' B R L' B)\n"
},
[12] = {
	.scramble = "D F D' L2 U L B' U2 R F2 L2 B2 D' B2 D' L2 D' F2 B2 U' L2",
	.solutions =
		"(D F D' L2 U L B' U2 R)\n"
		"(L B L2 D F' L2 D F' L)\n"
},
[13] = {
	.scramble = "F2 D2 L F2 R' L' F2 B R' U2 R2 U' R2 D B2 D' L2 U' R2 D2",
	.solutions =
		"R L B' R B' R2 B2 U F\n"
		"R2 L B R' B2 R' B2 U F\n"
		"R U' L B' U' R F2 U2 B\n"
		"R U' L B' U' R B2 D2 B\n"
		"U2 F2 R' D F U2 L' F2 R\n"
		"U' L' F U F2 D R' F2 R\n"
		"U2 F2 R' D F U2 R' D2 L\n"
		"U' D2 F' R' B2 D R' B' L\n"
		"U' L' F U F2 D L' U2 L\n"
		"F' L F U2 L2 U' F' U2 L\n"
		"F' L F D2 R2 U' B D2 L\n"
		"(F2 U2 B D2 R B' D2 L' F)\n"
		"(L U2 D' B R B2 U2 R' B)\n"
		"(F2 D2 L F2 R' L' F2 B R)\n"
		"(R' U2 L2 F2 L U2 F' B2 L)\n"
},
[14] = {
	.scramble = "D' B' U' R' L' D L' U' B' D F R2 D2 L2 F' R2 B U2 D2 B2 D2",
	.solutions =
		"L2 U B2 R L' F U2 L D' F\n"
		"F' L2 B' R B2 L2 D' L U2 F\n"
		"D' L B U L' D' L' U F B\n"
		"D' L B U L' D' L' U' F B\n"
		"U F R U' L B' R2 L2 B' R\n"
		"U' D L' F R U' D2 F' D2 R\n"
		"D2 F' D R F U' L' F U R\n"
		"B2 R' D B R F U' D2 F R\n"
		"U F R U' L F' U2 D2 F' L\n"
		"L U L' F R L U D2 F' L\n"
		"F2 L' U B L F U2 D' F L\n"
		"(U R' L' U2 D2 F' R U' D2 F)\n"
		"(R' B U F2 U R' U' R' L' F)\n"
		"(R' B U' L2 U2 F2 R' B2 L' F)\n"
		"(U' R' L B U2 F D2 R U B)\n"
		"(D2 B L2 U' D B' L B2 R' B)\n"
		"(D2 B L2 U' D2 B R' B2 L B)\n"
		"(R2 B R U B2 L D2 R U2 B)\n"
		"(R' B U' R2 D2 B2 R' F2 L' B)\n"
		"(U B' R B2 R L2 U' F' B2 L)\n"
		"(F2 B' R2 L D' R2 B' U2 B' L)\n"
},
[15] = {
	.scramble = "F2 D' F2 R2 F' U R D' F B2 L D2 R' D2 R' B2 L F2 L' D2 B2",
	.solutions =
		"L' U' R D' F D' L2 D B\n"
},
[16] = {
	.scramble = "U' F2 L F D' B2 U' R U L2 F U2 F L2 F2 U2 B' R2 L2 D2 F2",
	.solutions =
		"R2 U' L' B' D' B R2 D' B\n"
		"F' B U' R2 B2 U F' D2 R\n"
},
[17] = {
	.scramble = "F R L2 U B' D2 F' L2 U2 D' F2 U2 R2 F U2 R2 B U2 D2",
	.solutions =
		"(L2 F R' U D2 L2 F' R2 F)\n"
		"(L2 F R' U D2 L2 B' D2 B)\n"
},
[18] = {
	.scramble = "F' U' L' F L' D2 F U' F B2 R D2 B2 L' F2 L U2 D2 F2 R B2",
	.solutions =
		"D2 L' B R U D2 B' D R\n"
		"B U F' U' R U F2 B R\n"
},
[19] = {
	.scramble = "U2 R2 L D2 B' U' B2 R2 F R2 L U' F2 U2 B2 U L2 D2 L2 U B2",
	.solutions =
		"(D' R2 U' B' L' U L' F R F)\n"
		"(L F B D' R' F' U' L2 D F)\n"
		"(L' D F R' B2 U F' L' U' F)\n"
		"(L' B' L2 B' U L2 F' U2 L' F)\n"
		"(D2 F' R L U' B2 L2 F' U' R)\n"
		"(R2 U' B2 R F D F B' D R)\n"
		"(L2 D' F2 R B U F' B U R)\n"
		"(B D F' U2 L U2 R' U2 F' R)\n"
		"(U2 R2 L D2 B' U' B2 R2 F L)\n"
		"(D R U' B' U' D2 F2 R' B L)\n"
		"(R B R2 U2 F2 R' D' B D2 L)\n"
		"(B U L' F' U' R D' R B' L)\n"
		"(B D R' L2 B' R' B R F' L)\n"
		"(B D F' R' D' R D' R B' L)\n"
		"(B' U2 F' L F2 U2 B D F' L)\n"
		"(B' U2 F' L B U2 F2 D F' L)\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
