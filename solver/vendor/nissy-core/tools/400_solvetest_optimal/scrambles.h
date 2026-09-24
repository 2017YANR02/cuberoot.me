struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "R' D R U R' D' R U'",
	.solutions =
		"U R' D R U' R' D' R\n"
		"B' D2 B U' B' D2 B U\n"
},
[1] = {
	.scramble = "R' L U2 R L' B2",
	.solutions =
		"B2 R' L U2 R L'\n"
		"R L' B2 R' L U2\n"
		"R B2 R' L U2 L'\n"
		"L' B2 R' L U2 R\n"
},
[2] = {
	.scramble = "R2 U2 R2 U2 R2 U2",
	.solutions =
		"U2 R2 U2 R2 U2 R2\n"
		"D2 L2 U2 L2 D2 R2\n"
		"U2 L2 D2 R2 D2 L2\n"
		"D2 R2 D2 L2 U2 L2\n"
		"R2 U2 R2 U2 R2 U2\n"
		"L2 D2 R2 D2 L2 U2\n"
		"R2 D2 L2 U2 L2 D2\n"
		"L2 U2 L2 D2 R2 D2\n"
},
[3] = {
	.scramble = "R U2 R' U' R U2 L' U R' U' L", /* J-perm */
	.solutions =
		"R2 D' R' D R' B2 L U' L' B2\n"
		"B2 L U L' B2 R D' R D R2\n"
},
[4] = {
	.scramble = "R' U' F D2 L2 F R2 U2 R2 B D2 L B2"
	            "D' B2 L' R' B D2 B U2 L U2 R' U' F", /* FMC2019 A1 */
	.solutions =
		"D2 F' U2 D2 F' L2 D R2 D F B2 R' L2 F' U' D\n"
},
[5] = {
	.scramble = "L B' D2 R2 L2 B' U2 D2 R L' U F2", /* Taken from 6 */
	.solutions =
		"B2 R2 L2 D F2 B2 R' L F' U2 B L'\n"
		"F2 U' R' L U2 D2 B R2 L2 D2 B L'\n"
},
[6] = {
	.scramble = "R L' B R L' D R L' F R L' U"
	            "R' L F R L' D R L' B R L' U", /* Random thing */
	.solutions =
		"U' R L' B' D2 F R' L F2 B2 U' F2 R2 L2 U2\n"
		"U' R L' B' R2 L2 U2 B' U2 D2 R' L D B2 U2\n"
		"D2 R' L F R' B' R U B U L F' U' F' D\n"
		"D' R' L B' U2 F R L' F2 B2 D' R2 L2 B2 D2\n"
		"D' R' L B' D2 R2 L2 B' U2 D2 R L' U F2 D2\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
