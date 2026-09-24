struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "U F2 U' R2 U L2 B2 L2 U D2 R2 L2 F2",
	.solutions =
		"(U F2 R2 B2 R2 U)\n"
		"(U F2 L2 B2 L2 U)\n"
		"(D R2 F2 R2 B2 U)\n"
		"(D R2 B2 R2 F2 U)\n"
},
[1] = {
	.scramble = "U L2 F2 U F2 U' D' L2 B2 U F2 D' R2 U'",
	.solutions =
		"(U F2 U F2 U' F2 U L2 U)\n"
		"(U F2 U' F2 U L2 U' F2 U)\n"
		"U R2 U L2 U (U L2 F2 U)\n"
		"D B2 U F2 U (U R2 B2 U)\n"
		"R2 U (U F2 U' F2 U L2 U)\n"
		"R2 U (U' F2 U L2 U' F2 U)\n"
},
[2] = {
	.scramble = "R2 L2 U2 B2 L2 U' R2 U F2 D R2 D' B2",
	.solutions =
		"B2 U2 R2 U F2 U\n"
},
[3] = {
	.scramble = "R2 D2 R2 F2 U L2 B2 D L2 F2 D L2",
	.solutions =
		"R2 D' B2 U R2 U\n"
		"(F2 U' F2 U F2 U)\n"
},
[4] = {
	.scramble = "D F2 D F2 U' F2 B2 L2 U' D2 L2",
	.solutions =
		"(D F2 U L2 U' F2 U)\n"
		"(D' B2 U' B2 U R2 U)\n"
		"L2 U (U L2 U B2 U)\n"
},
[5] = {
	.scramble = "R2 B2 R2 L2 U B2 D' L2 D F2 D' B2 D' L2 U",
	.solutions =
		"U R2 U' F2 U (U B2 U' F2 U)\n"
		"F2 D B2 U L2 U2 B2 U (B2 U)\n"
		"F2 D B2 U' B2 U2 L2 U (B2 U)\n"
		"F2 D F2 U F2 U2 L2 U (B2 U)\n"
		"F2 D F2 U' L2 U2 F2 U (B2 U)\n"
},
[6] = {
	.scramble = "F2 U2 B2 R2 D' R2 U2 L2 B2 L2 D R2 D",
	.solutions =
		"(L2 U B2 L2 U F2 U)\n"
		"U2 B2 U (L2 U L2 U)\n"
},
[7] = {
	.scramble = "D2 B2 L2 F2 D B2 U B2 R2 B2 D2 R2 D'",
	.solutions =
		"U B2 U' L2 U\n"
},
[8] = {
	.scramble = "U2 B2 U' R2 B2 U' R2 B2 U' B2 D' R2 D L2 D'",
	.solutions =
		"U R2 U' F2 U L2 U2 B2 U\n"
		"U R2 U' F2 U' B2 U2 L2 U\n"
		"U R2 U' B2 U F2 U2 L2 U\n"
		"U R2 U' B2 U' L2 U2 F2 U\n"
		"U2 L2 U (B2 U B2 U' L2 U)\n"
		"U' L2 B2 U' R2 U (U2 F2 U)\n"
		"D B2 U' L2 U (R2 U2 B2 U)\n"
},
[9] = {
	.scramble = "B2 R2 U R2 U' L2 D F2 R2 U2 R2 L2 U",
	.solutions =
		"D B2 L2 U' L2 U R2 U\n"
		"(L2 U R2 U' R2 U F2 U)\n"
		"(L2 U' R2 U F2 U' R2 U)\n"
		"D (B2 R2 U R2 U' L2 U)\n"
		"B2 D (R2 U F2 U' L2 U)\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
