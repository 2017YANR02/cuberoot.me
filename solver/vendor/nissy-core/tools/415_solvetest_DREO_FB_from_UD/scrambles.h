struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "R F2 R2 B' R' L' F' R B2 D2 B' L2 U2 B2 R2 B' U2 D2 B",
	.solutions =
		"U2 B R2 F L U2 B' R\n"
		"D2 L B D2 L F' D2 R\n"
		"D2 F L' U2 B' L F R\n"
		"(R F2 R2 B' R' L' F' R)\n"
		"(L B U2 B L B' D2 R)\n"
		"(B2 L2 B U2 L D2 B' R)\n"
		"(R' B2 L' B L2 U2 B L)\n"
		"(B U2 L' B' R F2 B' L)\n"
		"(B L' U2 B' R F2 B' L)\n"
		"(B2 L2 B D2 R D2 F' L)\n"
},
[1] = {
	.scramble = "R' B2 R' B' D2 L F D2 B D2 R2 F' R2 U2 L2 B R2 F D2",
	.solutions =
		"(R' B2 R' B' D2 L)\n"
},
[2] = {
	.scramble = "R' B L' D2 L' F' U2 L B' R2 B R2 L2 B2 L2 F D2 B' R2 B R2",
	.solutions =
		"R2 F L D2 B' R\n"
},
[3] = {
	.scramble = "R L B2 L2 F U2 R' B' D2 R U2 D2 L U2 R' L' F2 U2 R",
	.solutions =
		"F R U2 B R F R\n"
		"F R' F' B2 R B R\n"
		"F R D2 F L B L\n"
},
[4] = {
	.scramble = "L2 B2 D2 L' B R F' R2 D2 B2 D2 F2 D2 L' F2 L B2 L2 B2",
	.solutions =
		"D2 U2 F' R B L\n"
},
[5] = {
	.scramble = "D2 F' R F' L F' U2 L D2 B2 L2 F2 R2 F D2 R2 B U2 D2",
	.solutions =
		"F B2 R F2 B2 R' F R\n"
		"(F2 D2 L' F L2 F D2 R)\n"
		"(D2 F' R F' L F' U2 L)\n"
},
[6] = {
	.scramble = "D2 F2 L F2 R' B' R B2 R2 D2 L' U2 D2 B2 L' F2 L2 B2",
	.solutions =
		"(F2 R U2 R D2 R)\n"
		"(F2 L F2 L U2 R)\n"
		"(F2 R U2 L B2 L)\n"
		"(F2 L F2 R B2 L)\n"
},
[7] = {
	.scramble = "F' R' F' L U2 F' U2 L F2 R' B2 D2 B2 F2 L' D2 L' B2 U2",
	.solutions =
		"(F B2 R' F' U2 R)\n"
},
[8] = {
	.scramble = "U2 F D' F' D R' B L' U L2 D' B2 U' L2 B2 D R2 U R2 L2",
	.solutions =
		"U2 B L2 D2 L' B' R\n"
		"L2 F' D2 F' L' F' R\n"
		"U2 B' R2 U2 R' B' L\n"
		"L2 B' L2 B' R' F' L\n"
},
[9] = {
	.scramble = "U2 L B U2 B L2 U2 L U2 B' D2 R2 F2 L2 B L2 F L2",
	.solutions =
		"U2 B2 U2 R L2 U2 B R\n"
		"L2 U2 B2 U2 R U2 B R\n"
		"L2 F2 D2 F2 R U2 B R\n"
		"L2 F2 B2 L' D2 F2 B R\n"
		"L2 B2 U2 B2 R U2 B R\n"
		"L2 F' U2 B2 L' B' U2 L\n"
		"(F' B' L2 U2 R D2 B R)\n"
		"(U2 L B U2 B R2 D2 L)\n"
		"(U2 L B U2 B L2 U2 L)\n"
},
[10] = {
	.scramble = "B' R2 B2 F D2 R' F2 R2 L U2 R2 U2 F' U2 R2 B' U2 F' U2 R2 F2",
	.solutions =
		"R F' L' B L\n"
},
[11] = {
	.scramble = "D2 B R' L B' L' D2 B F2 R2 F2 R' F2 D2 L F2 L' D2 F2 R D2",
	.solutions =
		"R' D2 B R' B U2 F2 R\n"
		"F' L' F D2 B L' D2 R\n"
		"R' D2 B R' B D2 B2 L\n"
		"L' U2 F R2 L2 U2 F L\n"
		"F' L' F D2 B R' B2 L\n"
		"(B R B L' F' D2 U2 R)\n"
},
[12] = {
	.scramble = "F R L' B' F' R L2 B R2 F2 R' B2 L' B2 L D2 L' F2 L' B2 R2",
	.solutions =
		"U2 R2 L2 F R D2 R F2 R\n"
		"U2 R2 L2 F R' F2 R' D2 R\n"
		"U2 R2 L2 F L B2 L B2 R\n"
		"U2 R2 L2 F L' U2 L' U2 R\n"
		"U2 R2 L2 F' R D2 R F2 R\n"
		"U2 R2 L2 F' R' F2 R' D2 R\n"
		"U2 R2 L2 F' L B2 L B2 R\n"
		"U2 R2 L2 F' L' U2 L' U2 R\n"
		"U2 L' D2 R' B L' D2 F R\n"
		"D2 R2 L B' R L D2 F' R\n"
		"R U2 R L' D2 L F B R\n"
		"R U2 R L' D2 L' F B R\n"
		"R L U2 B L' F L' B R\n"
		"R L U2 B L' F' L' B R\n"
		"R L F L U2 B' R F R\n"
		"R L F L' U2 B R F R\n"
		"R F U2 B2 R F R2 F R\n"
		"R F U2 B2 R' F R2 F R\n"
		"R F2 U2 L2 B2 R F B R\n"
		"R F2 U2 L2 B2 R' F B R\n"
		"R F2 L' B L' B2 R F R\n"
		"R B2 U2 L2 F2 R F B R\n"
		"R B2 U2 L2 F2 R' F B R\n"
		"R B' L F L B' R' B R\n"
		"R B' L F L' B' R' B R\n"
		"R' U2 B2 L2 D2 R F B R\n"
		"R' U2 B2 L2 D2 R' F B R\n"
		"R' D2 F2 R2 U2 R F B R\n"
		"R' D2 F2 R2 U2 R' F B R\n"
		"R' L' D2 F L' B L' F R\n"
		"R' L' D2 F L' B' L' F R\n"
		"R' L' B L D2 F' R B R\n"
		"R' L' B L' D2 F R B R\n"
		"R' F2 R2 U2 B2 R F B R\n"
		"R' F2 R2 U2 B2 R' F B R\n"
		"R' B2 L2 D2 F2 R F B R\n"
		"R' B2 L2 D2 F2 R' F B R\n"
		"L U2 F2 L2 D2 L F B R\n"
		"L U2 F2 L2 D2 L' F B R\n"
		"L D2 F2 L2 U2 L F B R\n"
		"L D2 F2 L2 U2 L' F B R\n"
		"L F2 R L' B2 R F B R\n"
		"L F2 R L' B2 R' F B R\n"
		"L' U2 R2 B2 D2 L F B R\n"
		"L' U2 R2 B2 D2 L' F B R\n"
		"L' D2 L2 F2 U2 L F B R\n"
		"L' D2 L2 F2 U2 L' F B R\n"
		"L' F2 U2 R2 B2 L F B R\n"
		"L' F2 U2 R2 B2 L' F B R\n"
		"L' F2 R B L' B2 R F R\n"
		"L' B2 D2 L2 F2 L F B R\n"
		"L' B2 D2 L2 F2 L' F B R\n"
		"F2 L' F' R B L' F' B2 R\n"
		"B L' F R' L2 F' L' B2 R\n"
		"U2 R2 L2 F R D2 L D2 L\n"
		"U2 R2 L2 F R' F2 L' F2 L\n"
		"U2 R2 L2 F L B2 R D2 L\n"
		"U2 R2 L2 F L' U2 R' F2 L\n"
		"U2 R2 L2 F' R D2 L D2 L\n"
		"U2 R2 L2 F' R' F2 L' F2 L\n"
		"U2 R2 L2 F' L B2 R D2 L\n"
		"U2 R2 L2 F' L' U2 R' F2 L\n"
		"U2 L2 D2 B' R F' R2 U2 L\n"
		"U2 L2 D2 B' R F' L2 D2 L\n"
		"U2 L2 D2 B' R' U2 L2 B L\n"
		"R D2 R' L D2 R F B L\n"
		"R D2 R' L D2 R' F B L\n"
		"R L F L D2 F' L B L\n"
		"R L F L' D2 F L B L\n"
		"R F2 D2 R2 F2 L F B L\n"
		"R F2 D2 R2 F2 L' F B L\n"
		"R B2 D2 R2 B2 L F B L\n"
		"R B2 D2 R2 B2 L' F B L\n"
		"R B2 R' B R' B2 L F L\n"
		"R' U2 B2 L2 U2 L F B L\n"
		"R' U2 B2 L2 U2 L' F B L\n"
		"R' D2 F2 R2 D2 L F B L\n"
		"R' D2 F2 R2 D2 L' F B L\n"
		"R' L' B L U2 B' L F L\n"
		"R' L' B L' U2 B L F L\n"
		"R' F2 R2 D2 F2 L F B L\n"
		"R' F2 R2 D2 F2 L' F B L\n"
		"R' B2 L2 U2 B2 L F B L\n"
		"R' B2 L2 U2 B2 L' F B L\n"
		"L U2 B2 R2 U2 R F B L\n"
		"L U2 B2 R2 U2 R' F B L\n"
		"L D2 B2 R2 D2 R F B L\n"
		"L D2 B2 R2 D2 R' F B L\n"
		"L B2 R' L B2 L F B L\n"
		"L B2 R' L B2 L' F B L\n"
		"L B' R F L' F L B L\n"
		"L' U2 R2 F2 U2 R F B L\n"
		"L' U2 R2 F2 U2 R' F B L\n"
		"L' D2 L2 B2 D2 R F B L\n"
		"L' D2 L2 B2 D2 R' F B L\n"
		"L' F2 U2 R2 F2 R F B L\n"
		"L' F2 U2 R2 F2 R' F B L\n"
		"L' B2 D2 L2 B2 R F B L\n"
		"L' B2 D2 L2 B2 R' F B L\n"
		"L' B2 L B R' B2 L F L\n"
		"B L' F R' L2 F' R' U2 L\n"
		"(L' F R D2 B L' F2 B R)\n"
		"(F U2 R' B D2 L U2 B' R)\n"
		"(F2 L' F' L' D2 R D2 B' R)\n"
		"(D2 R2 B2 R' B U2 R2 F2 L)\n"
		"(D2 R2 B2 R' B U2 L2 B2 L)\n"
		"(D2 F2 R' L2 B' D2 R2 F2 L)\n"
		"(D2 F2 R' L2 B' D2 L2 B2 L)\n"
		"(R' F R B L D2 B U2 L)\n"
		"(R' F R B L' U2 F' D2 L)\n"
		"(L F' R' B D2 L' B' D2 L)\n"
		"(F D2 L' F D2 R U2 F' L)\n"
		"(F R' F' B U2 L' F D2 L)\n"
		"(F L' D2 F R F' U2 F' L)\n"
		"(B' R B' U2 B2 L F B2 L)\n"
},
[13] = {
	.scramble = "R2 L B U2 D2 B2 F R' F2 L2 B' R2 D2 L2 F2 D2 F' U2 B D2",
	.solutions =
		"R' D2 B' R2 B U2 R\n"
},
[14] = {
	.scramble = "B L F' U2 B2 U2 B2 L B D2 B2 D2 F' D2 R2 F' R2 B'",
	.solutions =
		"R' F2 B U2 R F2 R\n"
		"R' F2 B U2 L D2 L\n"
		"(B L B' R2 F' B L)\n"
},
[15] = {
	.scramble = "B' F U2 B2 R' F U2 R2 L F R2 U2 B2 U2 R2 B2 R2 F' R2",
	.solutions =
		"D2 U2 R F' B R' U2 R\n"
		"D2 U2 R F' B L' B2 L\n"
		"(L2 F R' B L D2 B R)\n"
		"(L' U2 R' F' D2 F2 B' R)\n"
		"(R F L B' R' F2 B' L)\n"
		"(R F L' B' R' F2 B' L)\n"
		"(L' F' R' B' R' L2 F' L)\n"
		"(F B' U2 B2 R' F U2 L)\n"
},
[16] = {
	.scramble = "R2 L B' L F R' B L2 B2 L2 D2 B' U2 F R2 B' U2 B' L2 D2",
	.solutions =
		"(R2 L B' L F R)\n"
},
[17] = {
	.scramble = "F' R L' B2 R B' F L' B U2 B' U2 R2 U2 F' R2 D2 F'",
	.solutions =
		"R' D2 R' F B' D2 F R\n"
		"R' F2 D2 R' F2 D2 B' R\n"
		"L' U2 F2 L' B2 U2 F' R\n"
		"L' F2 L' F B' U2 F R\n"
		"R' D2 R' F' B U2 F L\n"
		"R' F2 D2 R' B2 U2 B' L\n"
		"L' U2 F2 L' F2 D2 F' L\n"
		"L' F2 L' F' B D2 F L\n"
		"(F' R L' F2 L F B' R)\n"
		"(F' R' L B2 L F' B R)\n"
		"(F' R L' B2 R F B' L)\n"
		"(F' R' L F2 R F' B L)\n"
},
[18] = {
	.scramble = "L' B L2 U2 F2 L2 D2 R F D2 R2 U2 F2 U2 B' L2 U2 F L2",
	.solutions =
		"L2 F R' F2 D2 B' R\n"
		"L2 F R' B2 U2 B' L\n"
		"F' R' L2 F U2 F' L\n"
},
[19] = {
	.scramble = "R2 U2 F' R2 B2 D2 B2 L B R2 F2 R F2 L2 U2 R' B2 R' D2 F2 L B2",
	.solutions =
		"U2 F2 B R\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
