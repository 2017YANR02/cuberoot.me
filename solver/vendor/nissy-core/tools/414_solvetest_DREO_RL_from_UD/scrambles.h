struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "R F2 R2 B' R' L' F' R B2 D2 B' L2 U2 B2 R2 B' U2 D2 B",
	.solutions =
		"R D2 B R' L F\n"
},
[1] = {
	.scramble = "R' B2 R' B' D2 L F D2 B D2 R2 F' R2 U2 L2 B R2 F D2",
	.solutions =
		"L2 F' L' D2 B\n"
},
[2] = {
	.scramble = "R' B L' D2 L' F' U2 L B' R2 B R2 L2 B2 L2 F D2 B' R2 B R2",
	.solutions =
		"F' L B R2 F2 R' F\n"
		"F' L B' L2 B2 R F\n"
		"(D2 F' R2 B R L' F)\n"
		"(D2 F' L2 F R L' B)\n"
},
[3] = {
	.scramble = "R L B2 L2 F U2 R' B' D2 R U2 D2 L U2 R' L' F2 U2 R",
	.solutions =
		"U2 B' U2 F R' B' U2 F\n"
		"R' F R B2 R D2 U2 F\n"
		"L2 B D2 L' B2 D2 R' F\n"
		"F R' F2 L B L' D2 F\n"
		"F R' B2 R B R' U2 F\n"
		"F L' D2 L B R' U2 F\n"
		"U2 B' U2 F R' F' L2 B\n"
		"D2 F L' D2 B2 R L2 B\n"
		"L2 U2 B' L' U2 F2 R' B\n"
		"L2 B U2 R' F2 D2 L' B\n"
		"F L' U2 R F L' U2 B\n"
		"B2 L' B F R' F' L' B\n"
		"(R2 D2 R L B D2 R' F)\n"
		"(U2 R L B2 F U2 R' B)\n"
		"(U2 R L2 B2 F R' U2 B)\n"
		"(R L B2 L2 F U2 R' B)\n"
		"(L2 B' D2 B' R' U2 L B)\n"
},
[4] = {
	.scramble = "L2 B2 D2 L' B R F' R2 D2 B2 D2 F2 D2 L' F2 L B2 L2 B2",
	.solutions =
		"(D2 L2 B2 L B R F)\n"
		"(L2 B2 D2 L' B R F)\n"
		"(D2 R2 F2 L F R B)\n"
		"(R2 F2 U2 L' F R B)\n"
},
[5] = {
	.scramble = "D2 F' R F' L F' U2 L D2 B2 L2 F2 R2 F D2 R2 B U2 D2",
	.solutions =
		"B R2 U2 R D2 F2 L2 F\n"
		"B R2 U2 R D2 B2 R2 F\n"
		"B L2 D2 R U2 F2 L2 F\n"
		"B L2 D2 R U2 B2 R2 F\n"
		"B' R F2 L D2 L' U2 F\n"
},
[6] = {
	.scramble = "D2 F2 L F2 R' B' R B2 R2 D2 L' U2 D2 B2 L' F2 L2 B2",
	.solutions =
		"R2 L2 F D2 L2 F\n"
		"R2 L2 B L2 U2 F\n"
		"R2 L2 F U2 R2 B\n"
		"R2 L2 B R2 D2 B\n"
		"(U2 B2 R B2 L' F)\n"
		"(D2 F2 L F2 R' B)\n"
		"(B2 R' B2 D2 R' B)\n"
},
[7] = {
	.scramble = "F' R' F' L U2 F' U2 L F2 R' B2 D2 B2 F2 L' D2 L' B2 U2",
	.solutions =
		"(F' R' F' L U2 F)\n"
},
[8] = {
	.scramble = "U2 F D' F' D R' B L' U L2 D' B2 U' L2 B2 D R2 U R2 L2",
	.solutions =
		"U2 R B R' F' L' F\n"
		"U2 R B' R' F' L' F\n"
		"(R B2 F' U2 R2 L F)\n"
},
[9] = {
	.scramble = "U2 L B U2 B L2 U2 L U2 B' D2 R2 F2 L2 B L2 F L2",
	.solutions =
		"L' F D2 B R' D2 L F\n"
},
[10] = {
	.scramble = "B' R2 B2 F D2 R' F2 R2 L U2 R2 U2 F' U2 R2 B' U2 F' U2 R2 F2",
	.solutions =
		"(U2 B R2 F R' F L' F)\n"
		"(F U2 L B' F2 R2 L F)\n"
		"(B F2 R L2 F' R' L F)\n"
		"(B' R' B2 F' R2 F' L' F)\n"
		"(B' R' B' F2 U2 B' L' F)\n"
},
[11] = {
	.scramble = "D2 B R' L B' L' D2 B F2 R2 F2 R' F2 D2 L F2 L' D2 F2 R D2",
	.solutions =
		"L' B U2 L F' R2 L' F\n"
		"L F' L2 F2 R D2 R B\n"
		"L F' L2 B2 L U2 L B\n"
		"L' B D2 R B' R' L2 B\n"
		"(D2 B R' L B' L' D2 B)\n"
		"(B' F' R' F L D2 R B)\n"
},
[12] = {
	.scramble = "F R L' B' F' R L2 B R2 F2 R' B2 L' B2 L D2 L' F2 L' B2 R2",
	.solutions =
		"R2 D2 L' B' R D2 R' F\n"
		"(F' R' L U2 B' F' L' F)\n"
		"(B2 F' R' L B' F' L' F)\n"
		"(F R L' B' F' R L2 B)\n"
},
[13] = {
	.scramble = "R2 L B U2 D2 B2 F R' F2 L2 B' R2 D2 L2 F2 D2 F' U2 B D2",
	.solutions =
		"(L2 F' L2 F' U2 L' F)\n"
		"(L2 B' U2 B' D2 R' F)\n"
		"(B2 F' L D2 B L2 F)\n"
		"(B2 F' L D2 F U2 B)\n"
},
[14] = {
	.scramble = "B L F' U2 B2 U2 B2 L B D2 B2 D2 F' D2 R2 F' R2 B'",
	.solutions =
		"(R F R' U2 B L2 F)\n"
		"(R F R' U2 F U2 B)\n"
},
[15] = {
	.scramble = "B' F U2 B2 R' F U2 R2 L F R2 U2 B2 U2 R2 B2 R2 F' R2",
	.solutions =
		"L2 F R2 U2 R U2 L' F\n"
		"L2 F' R2 U2 R U2 L' F\n"
		"L2 F R2 D2 L U2 R' B\n"
		"L2 F' R2 D2 L U2 R' B\n"
		"(R' B' R F' R2 B L F)\n"
		"(B2 D2 F L B2 F2 L F)\n"
		"(B2 D2 F' L B2 F2 L F)\n"
		"(R' F' U2 F' L' D2 R B)\n"
		"(R' F' L F' L' B' R B)\n"
		"(R' B' R F' L2 F L B)\n"
		"(F' L F R' L2 B' R B)\n"
		"(B2 D2 F R D2 U2 R B)\n"
		"(B2 D2 F' R D2 U2 R B)\n"
		"(B' F' L B L F L B)\n"
},
[16] = {
	.scramble = "R2 L B' L F R' B L2 B2 L2 D2 B' U2 F R2 B' U2 B' L2 D2",
	.solutions =
		"(R' B R D2 F R2 F)\n"
		"(R' B' R D2 F R2 F)\n"
		"(D2 F R2 F' D2 R' B)\n"
		"(D2 B U2 B' D2 R' B)\n"
		"(R' B R D2 B U2 B)\n"
		"(R' B' R D2 B U2 B)\n"
},
[17] = {
	.scramble = "F' R L' B2 R B' F L' B U2 B' U2 R2 U2 F' R2 D2 F'",
	.solutions =
		"(F' U2 L2 B2 F2 L' F)\n"
},
[18] = {
	.scramble = "L' B L2 U2 F2 L2 D2 R F D2 R2 U2 F2 U2 B' L2 U2 F L2",
	.solutions =
		"R F L F2 D2 L' B\n"
		"R F' L D2 F2 L' B\n"
		"(U2 F' R L' B' R' F)\n"
		"(D2 B' R L' B' L' F)\n"
		"(R L B' L F' L' F)\n"
		"(R L' B' L F' L' F)\n"
		"(R' F' L D2 B U2 F)\n"
		"(U2 F' R' L F' R' B)\n"
		"(D2 B' R' L F' L' B)\n"
		"(R' F' L D2 F R2 B)\n"
		"(R2 B' R' F' L B F)\n"
		"(R2 B' R' F' L' B F)\n"
},
[19] = {
	.scramble = "R2 U2 F' R2 B2 D2 B2 L B R2 F2 R F2 L2 U2 R' B2 R' D2 F2 L B2",
	.solutions =
		"D2 L2 F R B2 F' R F\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
