struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "F' R B2 U2 L' D R L F2 U' F D2 R2 U2 B' D2 F R2 F R2 U2 L2",
	.solutions =
		"D' B' D U' R' U2 F2 D' U F\n"
		"D' B' D U' R' D2 B2 D U' F\n"
		"D' F' R L' U' R2 B2 R L' B\n"
		"D' F' R L' U' L2 F2 R' L B\n"
		"R2 F U R' U' F' D' R2 L2 B\n"
},
[1] = {
	.scramble = "B2 R D B' D L' F B' R' L2 F2 L2 D' F2 U' R2 F2 D' R2 D F2",
	.solutions =
		"(R' L' B R2 L' F' L' D)\n"
},
[2] = {
	.scramble = "F R B2 R2 B' L' F2 B' U' R' L2 F2 L2 F L2 F R2 F' R2 B' D2 B2",
	.solutions =
		"U2 F' U2 B R F L D F\n"
		"F2 L' F D' U2 L2 B R F\n"
		"F' U L U' L D' B' R F\n"
		"F2 L' F D' U2 R2 F R B\n"
		"B D' L' B2 R2 U' F L U\n"
		"(R F' U B R' F L2 B' D)\n"
},
[3] = {
	.scramble = "F R L' F2 L U' F' D' L' U' L2 B2 U2 R2 F2 U2 R2 U R2 U B2 D",
	.solutions =
		"U' R2 B' D B' U2 L' U R F\n"
		"U' R' L2 D R B' U' B L F\n"
		"D L F R2 D' R' B2 L' D2 F\n"
		"F2 D F R2 D' B2 L U' R B\n"
		"R U' R D U' R F2 R F' U\n"
		"R D U L U R F D R2 U\n"
		"R D' U' R U L B D L2 U\n"
		"R2 D R' D2 U L U' L2 B' U\n"
		"R2 D' L' D2 U R U' R2 F' U\n"
		"R D U L U R F U F2 D\n"
		"R D' U' R U L B U B2 D\n"
		"R L' F U' R L2 F L' F' D\n"
		"R2 D R D' F2 L D2 R' B D\n"
		"R2 D' L D' B2 R D2 L' F D\n"
		"(F D2 R' F2 B2 D2 U R2 B' D)\n"
},
[4] = {
	.scramble = "F D R L B' U' D2 R B' D B2 R2 L2 D2 B2 L2 B2 L2 B' R2",
	.solutions =
		"U2 R' U2 B D' R' U R2 B\n"
},
[5] = {
	.scramble = "U D L' D' R' B L' U B U F2 U2 B2 R2 U2 B2 U B2 D' F2 B2",
	.solutions =
		"U' F2 U2 L' U F R' B2 U\n"
		"D U2 R' D B2 D' F' B2 U\n"
		"R F U F' D R' U2 F' U\n"
		"F2 R2 D' L' B' R2 D2 R' U\n"
		"L2 B2 U L B D R' L2 D\n"
		"B2 D2 U' R F D R2 L' D\n"
},
[6] = {
	.scramble = "L' U D R' D2 F U' L' D2 B L2 D' R2 D2 R2 F2 D' R2 D F2 B2 U'",
	.solutions =
		"D U2 R2 B' U' L' D L2 D B\n"
		"F2 L' F D' U R F R2 L B\n"
		"(B' R2 D F2 R' L2 U2 B D' F)\n"
},
[7] = {
	.scramble = "D2 L2 B U2 F U2 R' U2 L' F2 D' F2 U' F2 R2 U' F2 U2 B2 U' B2",
	.solutions =
		"R2 F D U R2 U R F B\n"
		"R2 F D U R2 U R' F B\n"
		"(F L' F2 D R U2 F2 L' F)\n"
		"(D2 L2 F R2 B' D2 U2 L' U)\n"
		"(D2 R2 B D2 B' L2 B L D)\n"
		"(F' D2 B R2 U2 F D2 L D)\n"
		"(B' L2 B D2 R2 B D2 L D)\n"
},
[8] = {
	.scramble = "U' F' D B2 L U' L F L B' L2 U D2 B2 D F2 L2 U B2 D L2",
	.solutions =
		"L' F D B U R' D F' R F\n"
		"L' F D B U' R' D F' R F\n"
		"B U F' D2 F2 D L B U2 F\n"
		"U L U' B U F D R2 L' B\n"
		"L B L' U L F D R2 L' B\n"
		"L' F D B U R' D' B' L B\n"
		"L' F D B U' R' D' B' L B\n"
		"B U F' D2 F2 D L F R2 B\n"
		"U2 B D' L F U' R B R' D\n"
		"U2 B R F D' U L' U2 B' D\n"
		"B' R2 L U' B R' U F' R D\n"
		"(R F U2 F R' D2 U B' D' F)\n"
		"(R B L2 B L' D U2 B' U' F)\n"
		"(U2 L' F R L D U2 F U' B)\n"
		"(D2 R B L2 B L' D' F' U' B)\n"
},
[9] = {
	.scramble = "U' B2 R2 L2 F' R U2 L' U F L2 U L2 F2 R2 B2 U R2 D B2 R2",
	.solutions =
		"U' F L D B2 R' F2 B' D\n"
},
[10] = {
	.scramble = "U F2 R' D2 R F R L2 B' U R2 D R2 B2 D2 R2 F2 U' R2 F2 B2 U B2",
	.solutions =
		"(U F L' F D2 R L2 B)\n"
},
[11] = {
	.scramble = "U' R L' F2 B' L D' L D2 L' U R2 U2 F2 D2 F2 D R2 B2 D F2",
	.solutions =
		"D' L' D' F D2 U R U' F\n"
		"D2 L' D B' R2 F' B' L' U\n"
		"L F2 U' R F R2 U' L' U\n"
		"D2 L' D F B2 D2 B2 R' D\n"
		"D2 L' D F' B2 L U2 F2 D\n"
		"D2 L' D F' B2 L D2 B2 D\n"
		"(B D2 F' U' L U R' F' U)\n"
},
[12] = {
	.scramble = "R' B2 U L' B D' F R2 L' F D2 R2 L2 U' R2 D' R2 L2 B2 D L2 D",
	.solutions =
		"D U B R F2 B U' R L B\n"
		"D F2 L B L2 B' U' R U2 B\n"
		"R' L2 D' B' R2 D' R D' L' B\n"
		"L' D R2 L' B' D' F2 R2 L' B\n"
		"D R' F D2 B L' F R' B' U\n"
		"R2 B' L2 D' R L' B' U B2 U\n"
		"L2 D R B' L B U R' F' U\n"
		"L2 D R B' L' B U R' F' U\n"
		"R2 B' L2 D' R L' B' D L2 D\n"
		"F' R' L' B R U' F' L F2 D\n"
		"(L' F' L D B D U B' R U)\n"
		"(B2 L F' D' B U B D2 R U)\n"
},
[13] = {
	.scramble = "U L' F U R' F2 D B' U L U R2 F2 B2 U' L2 U2 R2 D R2 D2",
	.solutions =
		"L F2 R U' F' B L' D F\n"
},
[14] = {
	.scramble = "L F' D B L F D' R F' R2 U' L2 U' B2 D' F2 R2 D2 F2",
	.solutions =
		"(L2 B2 U R U2 R U' B)\n"
		"(D U' F2 L' U' B L' D)\n"
},
[15] = {
	.scramble = "R B' D F U' F L2 B U' R D F2 L2 B2 L2 U2 D R2 L2 B2 U2",
	.solutions =
		"L2 D2 U2 R' F U B D U\n"
		"L2 D2 U2 R' F U B' D U\n"
},
[16] = {
	.scramble = "B' L U2 F L' B U F2 U' F2 D2 B R2 B U2 D2 R2 U2 B2 L2 F2",
	.solutions =
		"U2 L B' U2 L' D B R D F\n"
		"R' F' U B2 R D2 B U' R2 F\n"
		"L2 B L2 U' F2 U R L U2 F\n"
		"L2 B L2 D' L2 D R L U2 F\n"
		"B L B R F U L' D2 U F\n"
		"R D' L2 D B' R2 L' F2 U2 B\n"
		"R D' L2 D B' R2 L' B2 D2 B\n"
		"L2 B L2 U' F2 U R' L' D2 B\n"
		"L2 B L2 D' L2 D R' L' D2 B\n"
		"B R' U' F2 U' F' B2 D2 R B\n"
		"F2 L D F L D' R' F2 B D\n"
		"(F' R' F D F2 B2 R2 L' U' F)\n"
},
[17] = {
	.scramble = "U' D2 L' U2 F L B U R' B' U' L2 D R2 U' F2 D R2 D R2 F2 D'",
	.solutions =
		"F' D2 R' D' R' L' F B' D' F\n"
		"U L' D B' U2 R2 B2 R U B\n"
		"L B2 L' D' R' L F' R' U' B\n"
		"F2 B' U' B2 R2 F' L' U' R' B\n"
		"F' L D B D' U B2 R F' U\n"
		"L2 B2 L U' F2 R' F B' R' D\n"
		"F' R2 U F D U' R L' B' D\n"
		"(D' F2 B2 R L2 D2 F B2 U B)\n"
		"(D2 L F B D U2 R2 L' B U)\n"
		"(L D' L2 B2 R U' F B' R' U)\n"
		"(L D' R2 F2 R D F' B R D)\n"
},
[18] = {
	.scramble = "U B2 L B2 R B R' D L2 B U' R2 U' L2 B2 D L2 D' R2 F2 D' B2 D",
	.solutions =
		"L F' R F' D R U R D2 B\n"
		"(B2 U' L F R2 F D' U L2 F)\n"
		"(B2 U' L B U2 B D' U' R2 F)\n"
		"(B2 L' D' R' L2 F L2 U R' F)\n"
		"(B' U L' D' B2 R' B' U R2 F)\n"
		"(B' U L' B D R' U' F' D2 F)\n"
		"(B' U B' L' B2 D' R' U R2 F)\n"
		"(B2 U' L F R2 F D U' R2 B)\n"
		"(B2 U' L B U2 B D U L2 B)\n"
		"(B' U L' B D R' U' B' L2 B)\n"
		"(R' B D' B' L' U2 B U' R D)\n"
		"(L' D F' D' R' U2 B U' R D)\n"
		"(F' L F' L D' R U' F' L D)\n"
},
[19] = {
	.scramble = "R B2 D' B U' B' L2 F2 B D F2 U' B2 D' F2 U2 F2 R2 D' B2 U B2",
	.solutions =
		"R2 D' B D' L2 F' R2 D' F\n"
		"R B2 D' B2 R U' F2 B' U\n"
		"U2 R' F2 U' F2 R' U' B D\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
