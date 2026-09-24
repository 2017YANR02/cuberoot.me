struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "D' F U' B2 R' B D' L2 B D' F2 D' R2 F2 U' R2 D R2 U' R2 B2 D",
	.solutions =
		"(U D L)\n"
},
[1] = {
	.scramble = "L2 B R' B2 R D2 F D L U R2 U2 R2 F2 U' F2 U' L2 U' L2",
	.solutions =
		"U L\n"
},
[2] = {
	.scramble = "U L D B R' B' D F' R2 B D R2 U' F2 R2 D R2 U B2 D' F2",
	.solutions =
		"B F L D R\n"
		"B F L' D R\n"
		"B' F L D R\n"
		"B' F L' D R\n"
		"D' B R F' L\n"
		"D' B R' F' L\n"
		"D' B' R F' L\n"
		"D' B' R' F' L\n"
		"F D' B R L\n"
		"F D' B' R L\n"
		"(U D2 L B R)\n"
		"(U D2 L' B R)\n"
		"(U R2 L F' R)\n"
		"(U R2 L' F' R)\n"
		"(U L D B R)\n"
		"(U L' D B R)\n"
		"(U' D2 L B R)\n"
		"(U' D2 L' B R)\n"
		"(U' R2 L F' R)\n"
		"(U' R2 L' F' R)\n"
		"(U' L D B R)\n"
		"(U' L' D B R)\n"
		"(R U L F' R)\n"
		"(R U L' F' R)\n"
		"(R U' L F' R)\n"
		"(R U' L' F' R)\n"
		"(D2 B' U R L)\n"
		"(D2 B' U' R L)\n"
		"(R F U R L)\n"
		"(R F U' R L)\n"
},
[3] = {
	.scramble = "B' R' F' R' L U' L2 U F L U2 B2 D F2 D' L2 B2 D2 L2 F2 D' B2",
	.solutions =
		"L U D' B R\n"
		"L U B D2 R\n"
		"L' U D' B' R\n"
		"L' D' B' U2 R\n"
		"B L' U2 D' R\n"
		"B' L U D2 R\n"
		"L U' B' F2 L\n"
		"L F2 U' B' L\n"
		"L' D B F2 L\n"
		"L' F2 D B L\n"
		"(L' D B2 F R)\n"
		"(L' B2 D F R)\n"
		"(F' L' D B2 R)\n"
		"(F' L' B2 D R)\n"
		"(R' F R U L)\n"
		"(R' F R' U L)\n"
		"(L U2 D' B L)\n"
		"(L U2 B D' L)\n"
		"(L' U D' F' L)\n"
		"(L' D' F' U2 L)\n"
		"U2 F' L (F L)\n"
		"D L (U D L)\n"
		"L (U D F L)\n"
		"L (U L2 B' L)\n"
		"L (L U B' L)\n"
		"L (L B' U L)\n"
		"L (L' D F' L)\n"
		"L (L' F' D L)\n"
		"L (F' L2 D L)\n"
		"L (B' F' U' L)\n"
		"L U2 F' L (L)\n"
		"L2 U' B L (L)\n"
		"L2 B U2 L (L)\n"
		"L' B L (U2 L)\n"
		"F2 L (L' F' L)\n"
},
[4] = {
	.scramble = "D L F2 B' U' F D' B2 U L' F2 U B2 U2 L2 U' L2 D' R2 D2 F2 U F2",
	.solutions =
		"(U D' L B2 R)\n"
		"(U L D' B2 R)\n"
		"(U L B D' R)\n"
		"(U' D' L B2 R)\n"
		"(U' L D' B2 R)\n"
		"(U' L B D' R)\n"
		"(U D' R D2 L)\n"
		"(U' D' R D2 L)\n"
		"(R U R D L)\n"
		"(R U R' D L)\n"
		"(R U' R D L)\n"
		"(R U' R' D L)\n"
		"(D R U R L)\n"
		"(D R U' R L)\n"
		"U' D R (D L)\n"
		"B' U' R (U L)\n"
		"D' L (U B R)\n"
},
[5] = {
	.scramble = "F2 U F2 U2 B D B2 R F2 D2 B L2 D2 B2 U2 D2 B' L2 F L2",
	.solutions =
		"R2 D2 F L\n"
		"L2 U2 B' L\n"
		"L2 B' U2 L\n"
		"(U' D B' R)\n"
		"(U' B' D R)\n"
		"(D R2 F R)\n"
		"(R2 U' F' R)\n"
		"(R' D F R)\n"
		"U2 L (B' R)\n"
		"L (B' F R)\n"
},
[6] = {
	.scramble = "L F2 R' D L U' R' B' D B2 D2 L2 U2 F' L2 F B R2 B' R2",
	.solutions =
		"R B D F2 R\n"
		"R B F' D R\n"
		"R' F2 U' B R\n"
		"R' B F2 U' R\n"
		"L D' L F' R\n"
		"L D' L' F' R\n"
		"D R U2 B' L\n"
		"D R B' U2 L\n"
		"R U2 B' D' L\n"
		"R B' U2 D' L\n"
		"(U D L U2 R)\n"
		"(U D' L U2 R)\n"
		"(L D L U' R)\n"
		"(L D L' U' R)\n"
		"(L D' L U' R)\n"
		"(L D' L' U' R)\n"
		"(U D R B2 L)\n"
		"(U D' R B2 L)\n"
		"(D R U B2 L)\n"
		"(D R B2 U L)\n"
		"(D' R U B2 L)\n"
		"(D' R B2 U L)\n"
		"(U' L D R L)\n"
		"(U' L D' R L)\n"
		"R (U2 F' D' R)\n"
		"R (F' U2 D' R)\n"
		"R (F D B2 L)\n"
		"R (B' F D L)\n"
		"F' R (R D R)\n"
		"B R (U2 D' R)\n"
		"B2 F' R (D R)\n"
},
[7] = {
	.scramble = "B2 L' F' U' R' L2 D' B R L2 F' B' U2 L2 B U2 F' U2 R2 B' U2",
	.solutions =
		"L2 U L F R\n"
		"L2 U L' F R\n"
		"(R2 B L D R)\n"
		"(R2 B L' D R)\n"
		"(R2 B' L D R)\n"
		"(R2 B' L' D R)\n"
		"(B L U F' R)\n"
		"(B L F' U R)\n"
		"(B L' U F' R)\n"
		"(B L' F' U R)\n"
		"(R2 D' B R L)\n"
		"(R2 D' B' R L)\n"
		"F R (D B' L)\n"
		"F R (B' D2 L)\n"
		"F2 R (D B L)\n"
		"F2 D R (B' L)\n"
},
[8] = {
	.scramble = "D2 L U F B2 D L' U B' R F2 B2 L D2 L' D2 L2 D2 F2 R2 L'",
	.solutions =
		"L F R U' L\n"
		"L F R' U' L\n"
		"L F' R U' L\n"
		"L F' R' U' L\n"
		"F R L2 U' L\n"
		"F R B D L\n"
		"F R' L2 U' L\n"
		"F R' B D L\n"
		"F' R L2 U' L\n"
		"F' R B D L\n"
		"F' R' L2 U' L\n"
		"F' R' B D L\n"
		"B2 F R D L\n"
		"B2 F R' D L\n"
		"B2 F' R D L\n"
		"B2 F' R' D L\n"
		"L U F R L\n"
		"L U F' R L\n"
		"B2 D' F R L\n"
		"B2 D' F' R L\n"
		"(R2 F' R D' L)\n"
		"(R2 F' R' D' L)\n"
		"D F R (B2 R)\n"
		"R (U' L' B2 R)\n"
		"R (L' U' B2 R)\n"
		"R (L' B2 U' R)\n"
		"R (U' R' U2 L)\n"
		"F' R (U' B2 R)\n"
		"F' R (B2 U' R)\n"
		"L U R L (L)\n"
		"L U' R L (L)\n"
},
[9] = {
	.scramble = "U' L B R L U2 D R' U2 F R2 D2 F R2 F' B' D2 R2 L2",
	.solutions =
		"D' F' R\n"
		"R2 B R\n"
},
[10] = {
	.scramble = "D L U' F R2 L' U2 L' U2 B U' F2 R2 U L2 D B2 D' L2 D2 F2",
	.solutions =
		"R U' R (L)\n"
},
[11] = {
	.scramble = "R B R' U B' L' B R2 U' L' U' F2 U L2 U2 F2 D' L2 U B2 U2 F2 D'",
	.solutions =
		"(B L' F2 D R)\n"
		"(B' L' F2 D R)\n"
		"D' L (D' B' R)\n"
},
[12] = {
	.scramble = "F U2 F R' D' L' U L' F L2 F2 R2 F2 D2 L F2 R' D2 L F2 L",
	.solutions =
		"(L2 U L D2 R)\n"
		"(L2 U' L D2 R)\n"
		"(L' U L' D2 R)\n"
		"(L' U' L' D2 R)\n"
		"(U R' B2 D L)\n"
		"(L2 U R F2 L)\n"
		"(L2 U' R F2 L)\n"
		"(L' U R' B2 L)\n"
		"(L' U' R' B2 L)\n"
		"U R (U2 F2 R)\n"
		"U R (F2 U2 R)\n"
		"U R (D2 B2 L)\n"
		"U R (B2 D2 L)\n"
		"U D R (B2 L)\n"
		"U' F2 R (U R)\n"
		"R (R D' B2 L)\n"
		"R (R B2 D' L)\n"
		"L U' R (B R)\n"
		"L' U' R (B R)\n"
		"F U' R (U R)\n"
},
[13] = {
	.scramble = "R2 D F L2 B D L2 F' R' U2 F2 B2 L' D2 B2 L' U2 R U2 B2 R'",
	.solutions =
		"F2 L\n"
},
[14] = {
	.scramble = "U R' D' L B' D B U B R2 F2 L' B2 U2 R2 U2 R' U2 F2 R U2",
	.solutions =
		"L (L D R)\n"
		"L (L' D R)\n"
},
[15] = {
	.scramble = "D F2 R' U L2 B' D B2 U R2 L2 F' D2 R2 L2 F2 D2 F R2 D2 L2",
	.solutions =
		"(D F2 R)\n"
		"(F' D R)\n"
},
[16] = {
	.scramble = "F2 R D F L' B' D' L' U2 D' F L2 D2 F' B2 D2 B' R2 B2",
	.solutions =
		"(R2 D2 L)\n"
		"(L2 U2 L)\n"
},
[17] = {
	.scramble = "B U' F' D' L2 D' L' B' R F L2 F2 U2 F D2 F' R2 B L2 F2 D2",
	.solutions =
		"U2 B R L\n"
		"U2 B' R L\n"
},
[18] = {
	.scramble = "L2 F U2 R' D' F B' L' B2 L U2 F2 D' L2 D2 R2 B2 D' R2 L2 D2",
	.solutions =
		"(F' L F2 R)\n"
		"(R U F' L)\n"
		"(R F' U2 L)\n"
		"(F' R U2 L)\n"
		"D' L (R L)\n"
},
[19] = {
	.scramble = "R2 D F' U2 R2 L' U' D R B' R U2 F2 R' L2 F2 R F2 U2 F2 U2",
	.solutions =
		"U' B R D' L\n"
		"U' B R' D' L\n"
		"U' B' R D' L\n"
		"U' B' R' D' L\n"
		"D B R U L\n"
		"D B R' U L\n"
		"D B' R U L\n"
		"D B' R' U L\n"
		"B R U D' L\n"
		"B R' U D' L\n"
		"B' R U D' L\n"
		"B' R' U D' L\n"
		"U' D B R L\n"
		"U' D B' R L\n"
		"(D' F L U R)\n"
		"(D' F L' U R)\n"
		"(D' F' L U R)\n"
		"(D' F' L' U R)\n"
		"(U' F R D L)\n"
		"(U' F R' D L)\n"
		"(U' F' R D L)\n"
		"(U' F' R' D L)\n"
		"(U' D' F R L)\n"
		"(U' D' F' R L)\n"
		"R (L U R L)\n"
		"R (L U' R L)\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
