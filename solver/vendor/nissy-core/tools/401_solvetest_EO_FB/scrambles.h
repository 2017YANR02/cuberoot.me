struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "B R' F2 D' B' R B' L U R2 U' B2 U L2 B2 L2 U' D R2 U B2 R2",
	.solutions =
		"L F' U' F\n"
		"L' F D F\n"
		"R B' U' B\n"
		"R' B D B\n"
		"(U2 F' L2 F)\n"
		"(L2 F U2 F)\n"
		"(U B' U' B)\n"
		"(U2 B' U2 B)\n"
		"(U' B' U B)\n"
		"(L B L' B)\n"
		"(L2 B L2 B)\n"
		"(L' B L B)\n"
		"B (U D' B)\n"
		"B R' B (B)\n"
},
[1] = {
	.scramble = "U2 L F' B R2 B2 D' B R L2 D' L2 B2 L2 U' F2 U' L2 D2 B2 U' L2",
	.solutions =
		"(B U D2 F)\n"
		"R B (U' B)\n"
		"R L B (B)\n"
		"B (B R B)\n"
},
[2] = {
	.scramble = "U2 F U D' L2 U' B U L U R2 D2 B2 D' F2 U' L2 U2 F2 R2 F2",
	.solutions =
		"(D' B D2 F)\n"
		"(D' F L2 B)\n"
		"(F D' L2 B)\n"
		"(F L D' B)\n"
},
[3] = {
	.scramble = "F2 R B' U D' F U L2 D2 R F L2 U2 B' R2 D2 F2 B' D2 L2 F2",
	.solutions =
		"B R F (U2 F)\n"
		"B R' F (U F)\n"
		"B' R F (U2 F)\n"
		"B' R' F (U F)\n"
		"B (B2 U F B)\n"
		"B (B2 U' F B)\n"
		"F B (U R' F)\n"
		"F B (R' U2 F)\n"
},
[4] = {
	.scramble = "R' U' D' B D2 R' U L' D' F U L2 B2 U F2 U D L2 F2 L2 F2",
	.solutions =
		"D L' B (B)\n"
		"L' D B (B)\n"
},
[5] = {
	.scramble = "D' B R B2 L' F R U' R2 B' R2 F2 D' L2 U' L2 U B2 D F2 D' F2 L2",
	.solutions =
		"U F (R2 B)\n"
},
[6] = {
	.scramble = "L2 B' U D2 R2 D' B' L' U L2 U' F2 R2 D B2 L2 U2 D B2",
	.solutions =
		"F' B U F\n"
		"F' B' U F\n"
		"(D B' U2 F)\n"
		"(D' B' U2 F)\n"
		"(D F' L2 B)\n"
		"(D' F' L2 B)\n"
		"B (F D F)\n"
},
[7] = {
	.scramble = "F2 D' L2 B L F L B2 U' F2 R2 L2 U2 L2 F L2 B2 R2 B U2",
	.solutions =
		"F U' L' D' F\n"
		"F' U' R D F\n"
		"F' R U' D F\n"
		"(B D B L F)\n"
		"(B D B' L F)\n"
		"(B D' B L F)\n"
		"(B D' B' L F)\n"
		"(D F U2 R B)\n"
		"(D' F U2 R B)\n"
		"(L' B D F B)\n"
		"(L' B D' F B)\n"
		"(B L' D F B)\n"
		"(B L' D' F B)\n"
		"U F (D2 L' F)\n"
		"U2 F (D' L' F)\n"
		"U2 F (F2 R F)\n"
		"U2 D' F (L2 F)\n"
		"U2 R F (L F)\n"
		"U' F (F D' F)\n"
		"R U2 F (L F)\n"
		"F (U D' L F)\n"
		"F (U L D' F)\n"
		"F (D' F2 R' F)\n"
		"F (F D' R' F)\n"
		"F (F2 U R F)\n"
		"F' D L2 B (F)\n"
		"F' L2 D B (F)\n"
},
[8] = {
	.scramble = "D L2 F2 L U B R2 L' F U R2 U F2 D2 B2 R2 D' R2 U' F2 L2 D'",
	.solutions =
		"R' B U' R2 F\n"
		"R' B R2 U' F\n"
		"(F R2 U' D' F)\n"
		"(U F L2 D' B)\n"
		"(F L2 U' D' B)\n"
		"(F2 B U F B)\n"
		"(F2 B U' F B)\n"
		"U' R D F (F)\n"
		"D F (F U B)\n"
		"D F (F' U B)\n"
		"R F (D2 L F)\n"
		"R F (L D2 F)\n"
		"R U' D F (F)\n"
		"F (B L2 D F)\n"
		"B U' F (D' B)\n"
		"B' U' F (D' B)\n"
		"U2 F R B (B)\n"
		"U2 F' R B (B)\n"
		"F U R B (B)\n"
		"F B2 L' B (B)\n"
		"F' U R B (B)\n"
		"F' B2 L' B (B)\n"
},
[9] = {
	.scramble = "F R L2 U2 L' U2 R D' L F D2 L2 F R2 D2 B R2 U2 F2 R2 F",
	.solutions =
		"D2 B (F)\n"
},
[10] = {
	.scramble = "R' U' R2 L2 D' L' F' B R2 D' F' U2 D2 L2 U2 F' U2 B2 R2 B D2",
	.solutions =
		"U' B R2 D' F\n"
		"F U B R2 F\n"
		"F U' B R2 F\n"
		"F2 U B' L2 F\n"
		"F2 U' B' L2 F\n"
		"F U F D2 B\n"
		"F U' F D2 B\n"
		"F2 U F' D2 B\n"
		"F2 U' F' D2 B\n"
		"(B L B U F)\n"
		"(B L B' U F)\n"
		"(B L' B U F)\n"
		"(B L' B' U F)\n"
		"(L F R2 D B)\n"
		"(L' F R2 D B)\n"
		"(U' B L F B)\n"
		"(U' B L' F B)\n"
		"(B U' L F B)\n"
		"(B U' L' F B)\n"
		"U' R' F (L F)\n"
		"R' F (D L F)\n"
		"F2 L F (L F)\n"
		"F2 L2 F (L' F)\n"
		"B2 R2 F (L' F)\n"
		"U2 B (D' L B)\n"
		"U2 B (L D2 B)\n"
},
[11] = {
	.scramble = "U B D R' L2 U' L' F2 L' B' R2 B2 L2 B2 D R2 F2 D R2 F2 D' L2",
	.solutions =
		"D R F\n"
		"F2 L' F\n"
},
[12] = {
	.scramble = "U2 L' U L U' L2 U F' R F U2 F2 D' B2 D' F2 R2 U' F2 R2 U",
	.solutions =
		"F L F\n"
		"(F' R F)\n"
},
[13] = {
	.scramble = "U2 D R L U' R L F' R F D2 B L2 F' L2 D2 F U2 D2 F D2",
	.solutions =
		"U R2 B (F)\n"
		"R2 U B (F)\n"
		"B (U' D F)\n"
},
[14] = {
	.scramble = "L' B L F D' L U R' F2 B' R2 U2 B R2 U2 B U2 B' L2 U2 B2",
	.solutions =
		"U D F B\n"
		"U D' F B\n"
		"U' D F B\n"
		"U' D' F B\n"
		"D2 F (F B)\n"
},
[15] = {
	.scramble = "B D F L2 D2 L' B' R B' R2 L2 U' B2 U F2 U' D' B2 U' F2",
	.solutions =
		"U' F R L B\n"
		"U' F' R L B\n"
		"L' U' F R B\n"
		"L' U' F' R B\n"
		"L' F R U B\n"
		"L' F' R U B\n"
		"F R U L B\n"
		"F' R U L B\n"
		"(D' R' B D' F)\n"
		"(D' R' B' D' F)\n"
		"(R B D R' F)\n"
		"(R B R' D F)\n"
		"(R B' D R' F)\n"
		"(R B' R' D F)\n"
		"(R2 D' B R F)\n"
		"(R2 D' B' R F)\n"
		"(R2 B R D F)\n"
		"(R2 B' R D F)\n"
		"(D F D' R B)\n"
		"(D F R D' B)\n"
		"(D F' D' R B)\n"
		"(D F' R D' B)\n"
		"(D2 R' F D B)\n"
		"(D2 R' F' D B)\n"
		"(D2 F D R B)\n"
		"(D2 F' D R B)\n"
		"(R' D' F R' B)\n"
		"(R' D' F' R' B)\n"
		"U B' D2 F (F)\n"
		"U' F (D R' F)\n"
		"U' F (R' D F)\n"
		"U' D2 F (D F)\n"
		"U' B' D2 F (F)\n"
		"D2 F (U2 D F)\n"
		"R' L' F (R B)\n"
		"L' F (R L B)\n"
		"F (U D R' F)\n"
		"F (U R' D F)\n"
		"F (D R' U2 F)\n"
		"F (R' U2 D F)\n"
		"F (D' R L2 B)\n"
		"F (R D' L2 B)\n"
		"F (R L D' B)\n"
		"F (L D' R B)\n"
		"U F' R2 B (F)\n"
		"U' R' B (F B)\n"
		"U' F' R2 B (F)\n"
		"R B (F R' B)\n"
		"R B (F' R' B)\n"
},
[16] = {
	.scramble = "D F2 R L B D' F' R' B L' D2 L' U2 R U2 B2 L F2 L2 B2",
	.solutions =
		"R F B (B)\n"
		"R' F B (B)\n"
},
[17] = {
	.scramble = "R U2 F' L B' R' D2 L' F' D' R2 D' R2 D' F2 R2 F2 D R2",
	.solutions =
		"R' F (L B)\n"
},
[18] = {
	.scramble = "B' R2 B2 R D' R U' F2 U2 D L2 F' D2 R2 F2 D2 R2 L2 B' D2 B",
	.solutions =
		"B' U' D2 F\n"
		"(U2 B' R2 F)\n"
		"(R2 B U2 F)\n"
		"(U2 F' U2 B)\n"
		"(R2 F R2 B)\n"
		"F D2 F (B)\n"
		"B R2 B (B)\n"
},
[19] = {
	.scramble = "B L U' R2 D2 F B L U2 F' R2 F2 R2 L2 D' B2 L2 D2 L2 D' L2",
	.solutions =
		"U L' B D2 F\n"
		"U B D L' F\n"
		"U B L' D2 F\n"
		"U' L' B D2 F\n"
		"U' B D L' F\n"
		"U' B L' D2 F\n"
		"U L' F L2 B\n"
		"U' L' F L2 B\n"
		"F' U F L B\n"
		"F' U F' L B\n"
		"F' U' F L B\n"
		"F' U' F' L B\n"
		"F' L' U F B\n"
		"F' L' U' F B\n"
		"(R' L B U2 F)\n"
		"(R' L' B U2 F)\n"
		"(L B U R' F)\n"
		"(L B R' U2 F)\n"
		"(L' B U R' F)\n"
		"(L' B R' U2 F)\n"
		"(R' L F R2 B)\n"
		"(R' L' F R2 B)\n"
		"(F L F R B)\n"
		"(F L F' R B)\n"
		"(F L' F R B)\n"
		"(F L' F' R B)\n"
		"(R F L F B)\n"
		"(R F L' F B)\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
