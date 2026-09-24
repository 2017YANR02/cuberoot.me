struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "U' B U F U2 F2 R2 F' U2 L2 U' L2 F2 U F2 D' R2 F2 L2 D'",
	.solutions =
		"U F' U L2 D L2 U\n"
		"U F' U' B2 D' B2 U\n"
		"U F' D F2 U L2 U\n"
		"U F' D' R2 U' B2 U\n"
		"U' F' U L2 D L2 U\n"
		"U' F' U' B2 D' B2 U\n"
		"U' F' D F2 U L2 U\n"
		"U' F' D' R2 U' B2 U\n"
		"U F' U L2 U B2 D\n"
		"U F' U' B2 U' L2 D\n"
		"U F' D F2 D F2 D\n"
		"U F' D' R2 D' R2 D\n"
		"U' F' U L2 U B2 D\n"
		"U' F' U' B2 U' L2 D\n"
		"U' F' D F2 D F2 D\n"
		"U' F' D' R2 D' R2 D\n"
},
[1] = {
	.scramble = "B' U2 B' D' B L2 F' D F' R2 F L2 F' R2 F L2 F L2 F' D2 R2",
	.solutions =
		"U' B' U' B2 L2 F' U\n"
		"U' B' U' F2 R2 F' D\n"
},
[2] = {
	.scramble = "F' B D R2 B' L2 D B U D2 F2 R2 B2 L2 D B2 U' F2 R2",
	.solutions =
		"R2 D L2 B' L2 D2 F' U\n"
		"R2 D R2 F' L2 U2 B' D\n"
},
[3] = {
	.scramble = "F' B2 D2 R2 D R2 U B' R2 B2 D2 B2 D' F2 D' L2 D2 F2 U",
	.solutions =
		"B2 U' F L2 D' R2 F' U\n"
		"B2 U' F R2 U' R2 B' D\n"
},
[4] = {
	.scramble = "F B D2 R2 D L2 D' F' D F2 B2 L2 U2 D B2 U L2 U' B2 L2",
	.solutions =
		"(B D F2 L2 B R2 U)\n"
		"(F2 U' F U F L2 D)\n"
},
[5] = {
	.scramble = "U2 D2 B U L2 F' B' U' F U D' F2 U2 F2 R2 U F2 U2 R2 B2 D2",
	.solutions =
		"(D' L2 F' U' F2 U B2 U)\n"
		"(D' L2 F' D' L2 D B2 U)\n"
		"(D' L2 F' U' F2 D L2 D)\n"
		"(D' L2 F' D' L2 U R2 D)\n"
		"(F B U' B2 U' B L2 D)\n"
		"(F B D' R2 D' F R2 D)\n"
		"(F B' U' B2 U' B' L2 D)\n"
},
[6] = {
	.scramble = "R2 U F' R2 U' D F' U' F' R2 F D2 B L2 U2 B2 L2 F U2 R2",
	.solutions =
		"D F2 B U F' U B U\n"
		"D F' B2 U F2 U B' U\n"
		"D' B' U B' U' F2 B' U\n"
		"L2 U L2 D B2 U2 B' U\n"
		"L2 U L2 D' F2 D2 B U\n"
		"L2 D F2 U B2 U2 B' U\n"
		"F2 U' L2 F D2 B' L2 D\n"
		"(R2 U F' R2 U' D F' U)\n"
		"(R2 U' F' R2 U' D F' U)\n"
},
[7] = {
	.scramble = "L2 R2 U B D B L2 U' F R2 F' U2 D2 R2 D2 F2 U2 F R2 F2 U2",
	.solutions =
		"D R2 D2 L2 U2 F' U\n"
},
[8] = {
	.scramble = "F U' B' D' F' U' D2 B D' B2 U2 B2 L2 U B2 D2 L2 B2 R2 U",
	.solutions =
		"(B L2 D F' R2 U)\n"
		"(B' L2 D F' R2 U)\n"
},
[9] = {
	.scramble = "F' U D' R2 F U2 B U F2 L2 D2 B2 R2 D L2 D2 L2 B2 D L2 R2",
	.solutions =
		"U2 F' B' L2 D B2 U\n"
		"U2 F' B' L2 U R2 D\n"
},
[10] = {
	.scramble = "B U F L2 B L2 B' U' L2 D' F2 L2 B2 U F2 D' B2 U'",
	.solutions =
		"(U' F D B D' R2 U)\n"
		"(U' F R2 B U2 F' U)\n"
		"(U' F D B U' B2 D)\n"
		"(U' F' D' B' L2 F' D)\n"
},
[11] = {
	.scramble = "D2 B' U2 R2 F D R2 U2 F B R2 F' D2 B' D2 L2 U2 R2",
	.solutions =
		"(D2 B' U2 R2 F D)\n"
},
[12] = {
	.scramble = "U2 L2 U2 B U' F' B2 L2 U L2 R2 B2 U' F2 B2 D",
	.solutions =
		"F2 D2 R2 L2 U R2 B' U\n"
		"(U D R2 F U D F U)\n"
		"(U' D L2 B' U D B' U)\n"
		"(R2 D2 F' B U L2 B' U)\n"
		"(L2 D F D' B L2 F' U)\n"
		"(F' B' U' R2 F R2 B2 U)\n"
		"(F' B' U' F B' D2 B' U)\n"
		"(F' B' U' R2 F L2 F2 D)\n"
},
[13] = {
	.scramble = "R2 U F2 D2 L2 U R2 F B2 D' B2 D' F2 U2 B2 R2 D L2 U2 L2",
	.solutions =
		"(U L2 F R2 B R2 L2 U)\n"
},
[14] = {
	.scramble = "U B D' B2 L2 U D' F' D R2 D2 F2 L2 F2 U' B2 U2 L2 U' F2",
	.solutions =
		"(B D R2 D' B U)\n"
		"(B D' R2 D' B U)\n"
},
[15] = {
	.scramble = "B' R2 D' B2 D2 B D R2 F2 L2 D2 B D2 L2 B2 R2 B R2 F L2 U2 B",
	.solutions =
		"(B' R2 D' B2 D2 B D)\n"
},
[16] = {
	.scramble = "U F' L2 F U' B' L2 D' F B2 U D2 R2 B2 U B2 U B2 R2 U",
	.solutions =
		"(F U2 D F U2 F2 B U)\n"
		"(F U2 D F' B2 D2 B' U)\n"
		"(D' L2 B U B2 D F D)\n"
		"(D' L2 B D L2 U F D)\n"
},
[17] = {
	.scramble = "U2 B R2 F B2 R2 U2 D F U' R2 F2 R2 D2 R2 D' B2 U' B2",
	.solutions =
		"F2 D2 F U\n"
},
[18] = {
	.scramble = "F2 B2 D' F U D' F D' F' U' D' B2 L2 D2 R2 U R2 U L2 R2",
	.solutions =
		"R2 U' R2 U B D2 F U\n"
		"R2 U' R2 U' B D2 F U\n"
		"L2 U' F B' D F' R2 U\n"
		"R2 U' L2 D F U2 B D\n"
		"R2 U' L2 D' F U2 B D\n"
		"(F U' D' B' L2 B' R2 U)\n"
		"(F' R2 D' F2 U R2 F' U)\n"
		"(B D' F U2 B' R2 F' U)\n"
		"(B D' F B U' B2 R2 U)\n"
		"(B D' F B D' L2 B2 U)\n"
		"(F' L2 U' B2 D R2 B' D)\n"
		"(B D' F B U' F2 L2 D)\n"
		"(B D' F B D' R2 F2 D)\n"
},
[19] = {
	.scramble = "D2 B' U' D2 B' D' F R2 F' R2 B2 L2 U2 B' U2 D2 L2 B U2",
	.solutions =
		"(D2 B' U' D2 B' D)\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
