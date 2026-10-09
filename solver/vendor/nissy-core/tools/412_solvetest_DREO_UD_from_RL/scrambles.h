struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "U' B U F U2 F2 R2 F' U2 L2 U' L2 F2 U F2 D' R2 F2 L2 D'",
	.solutions =
		"D F U F' D B\n"
		"D F U' F' D B\n"
},
[1] = {
	.scramble = "B' U2 B' D' B L2 F' D F' R2 F L2 F' R2 F L2 F L2 F' D2 R2",
	.solutions =
		"B' F D F U' R2 F\n"
		"B' F D' F U' R2 F\n"
		"(U' B' F D B U2 F)\n"
		"(U' B' F D F R2 B)\n"
},
[2] = {
	.scramble = "F' B D R2 B' L2 D B U D2 F2 R2 B2 L2 D B2 U' F2 R2",
	.solutions =
		"(B D R2 B' L2 D B)\n"
},
[3] = {
	.scramble = "F' B2 D2 R2 D R2 U B' R2 B2 D2 B2 D' F2 D' L2 D2 F2 U",
	.solutions =
		"(B2 F' D2 L2 U R2 D F)\n"
		"(B2 F' D2 R2 D R2 U B)\n"
},
[4] = {
	.scramble = "F B D2 R2 D L2 D' F' D F2 B2 L2 U2 D B2 U L2 U' B2 L2",
	.solutions =
		"U2 B' U' R2 F L2 F\n"
		"U' R2 U' F L2 D' F\n"
		"U2 B' U' R2 B D2 B\n"
		"(D B' U2 B' L2 D' F)\n"
},
[5] = {
	.scramble = "U2 D2 B U L2 F' B' U' F U D' F2 U2 F2 R2 U F2 U2 R2 B2 D2",
	.solutions =
		"D' B U2 F' R2 D' B\n"
},
[6] = {
	.scramble = "R2 U F' R2 U' D F' U' F' R2 F D2 B L2 U2 B2 L2 F U2 R2",
	.solutions =
		"D B2 F U' F' L2 F\n"
		"D B2 F U' B' U2 B\n"
		"D B' F U B2 U' B\n"
},
[7] = {
	.scramble = "L2 R2 U B D B L2 U' F R2 F' U2 D2 R2 D2 F2 U2 F R2 F2 U2",
	.solutions =
		"(D2 F2 R2 L2 D B)\n"
		"(F D' R2 D L2 B)\n"
},
[8] = {
	.scramble = "F U' B' D' F' U' D2 B D' B2 U2 B2 L2 U B2 D2 L2 B2 R2 U",
	.solutions =
		"F' L2 B R2 D' F U B\n"
		"(F U' B' D' F' U' D2 B)\n"
},
[9] = {
	.scramble = "F' U D' R2 F U2 B U F2 L2 D2 B2 R2 D L2 D2 L2 B2 D L2 R2",
	.solutions =
		"F2 U B' F2 D F\n"
},
[10] = {
	.scramble = "B U F L2 B L2 B' U' L2 D' F2 L2 B2 U F2 D' B2 U'",
	.solutions =
		"(B U F L2 F U2 F)\n"
		"(B U F' U2 F' L2 F)\n"
		"(B U B D2 B D2 F)\n"
		"(B U B' R2 B' R2 F)\n"
		"(B U' F L2 F U2 F)\n"
		"(B U' F' U2 F' L2 F)\n"
		"(B U' B D2 B D2 F)\n"
		"(B U' B' R2 B' R2 F)\n"
		"(B U F L2 B L2 B)\n"
		"(B U F' U2 B' U2 B)\n"
		"(B U B D2 F L2 B)\n"
		"(B U B' R2 F' U2 B)\n"
		"(B U' F L2 B L2 B)\n"
		"(B U' F' U2 B' U2 B)\n"
		"(B U' B D2 F L2 B)\n"
		"(B U' B' R2 F' U2 B)\n"
},
[11] = {
	.scramble = "D2 B' U2 R2 F D R2 U2 F B R2 F' D2 B' D2 L2 U2 R2",
	.solutions =
		"(F' D2 R2 F D F' R2 F)\n"
		"(B' L2 D2 B D F' R2 F)\n"
		"(B' F2 U' D' F' R2 U' F)\n"
		"(F' D2 R2 F D B' D2 B)\n"
		"(B' L2 D2 B D B' D2 B)\n"
},
[12] = {
	.scramble = "U2 L2 U2 B U' F' B2 L2 U L2 R2 B2 U' F2 B2 D",
	.solutions =
		"(D2 R2 B U' F)\n"
		"(U2 L2 F U' B)\n"
},
[13] = {
	.scramble = "R2 U F2 D2 L2 U R2 F B2 D' B2 D' F2 U2 B2 R2 D L2 U2 L2",
	.solutions =
		"R2 L2 D' R2 U2 D B\n"
},
[14] = {
	.scramble = "U B D' B2 L2 U D' F' D R2 D2 F2 L2 F2 U' B2 U2 L2 U' F2",
	.solutions =
		"B' D2 L2 F R2 U F\n"
		"(U' F R2 L2 D L2 F)\n"
		"(B' D' B' U' L2 D2 F)\n"
		"(B' D' B' U' R2 U2 B)\n"
},
[15] = {
	.scramble = "B' R2 D' B2 D2 B D R2 F2 L2 D2 B D2 L2 B2 R2 B R2 F L2 U2 B",
	.solutions =
		"B2 D2 F U' B R2 F\n"
		"B2 D2 F U' F D2 B\n"
},
[16] = {
	.scramble = "U F' L2 F U' B' L2 D' F B2 U D2 R2 B2 U B2 U B2 R2 U",
	.solutions =
		"U2 B' U' D' B' U2 D' F\n"
		"D2 F' D' B' U' B' R2 F\n"
		"R2 U L2 B D F U' F\n"
		"F R2 U L2 B F U' F\n"
		"F' R2 D' B' U' D' R2 F\n"
		"D F' D' R2 B' U L2 B\n"
		"D2 F' D' B' U' F' U2 B\n"
		"F' R2 D' B' U D L2 B\n"
		"(U' F2 D' R2 U B U2 F)\n"
		"(U' F2 D' R2 U F R2 B)\n"
},
[17] = {
	.scramble = "U2 B R2 F B2 R2 U2 D F U' R2 F2 R2 D2 R2 D' B2 U' B2",
	.solutions =
		"F U' D2 L2 F L2 F\n"
		"F U' F2 U2 F D2 F\n"
		"F U' B2 D2 F U2 F\n"
		"F' U D2 R2 F' R2 F\n"
		"F' U F2 U2 F' D2 F\n"
		"F' U B2 D2 F' U2 F\n"
		"F U' D2 L2 B D2 B\n"
		"F U' F2 U2 B R2 B\n"
		"F U' B2 D2 B L2 B\n"
		"F' U D2 R2 B' D2 B\n"
		"F' U F2 U2 B' L2 B\n"
		"F' U B2 D2 B' R2 B\n"
},
[18] = {
	.scramble = "F2 B2 D' F U D' F D' F' U' D' B2 L2 D2 R2 U R2 U L2 R2",
	.solutions =
		"U F' U' B2 U' B' D2 F\n"
		"U F' U' B2 U' F' R2 B\n"
},
[19] = {
	.scramble = "D2 B' U' D2 B' D' F R2 F' R2 B2 L2 U2 B' U2 D2 L2 B U2",
	.solutions =
		"F2 D B F2 D F\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
