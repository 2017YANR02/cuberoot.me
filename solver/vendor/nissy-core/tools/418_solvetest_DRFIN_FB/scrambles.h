struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "F2 U2 B U2 B U2 R2 B D2 B' R2 F2 R2 L2",
	.solutions =
		"R2 L2 F2 R2 F L2 B' D2 R2 F' U2 B' U2 F2\n"
		"R2 L2 F2 R2 B D2 B' R2 U2 B' U2 B' U2 F2\n"
		"R2 L2 B2 L2 F R2 F' L2 D2 F' R2 F' U2 F2\n"
		"R2 B2 D2 F' R2 F2 U2 F' D2 F' D2 F D2 U2\n"
		"R2 B2 D2 F' R2 F2 U2 B' L2 F' L2 B D2 U2\n"
},
[1] = {
	.scramble = "B U2 B2 D2 L2 B U2 F' D2 L2 F2 D2 F'",
	.solutions =
		"F D2 L2 D2 F2 L2 F' U2 B' L2 F2 D2 B\n"
		"F D2 L2 D2 B2 R2 F' D2 B' R2 B2 D2 B\n"
		"F D2 F2 L2 D2 F U2 B' L2 D2 B2 U2 B'\n"
},
[2] = {
	.scramble = "B U2 B' L2 B L2 F' R2 F' L2 U2 B2",
	.solutions =
		"B2 U2 L2 B U2 B R2 F' U2 B R2 F'\n"
		"B2 U2 L2 F R2 F L2 B' L2 B U2 B'\n"
		"B2 U2 L2 F R2 B D2 B' D2 F U2 B'\n"
},
[3] = {
	.scramble = "B' L2 B' U2 B L2 U2 B' R2 B2 R2 U2 F' U2",
	.solutions =
		"U2 F U2 R2 B2 R2 B U2 L2 B' U2 B L2 B\n"
		"U2 B L2 U2 B2 U2 F U2 L2 F' L2 F L2 B\n"
		"F' D2 B' L2 F D2 L2 B' L2 U2 F2 D2 F' R2\n"
		"R2 L2 F L2 B D2 F2 B D2 B D2 R2 B L2\n"
		"R2 L2 B D2 F D2 F' L2 F' B2 D2 R2 B L2\n"
		"R2 L2 B D2 B R2 F2 B R2 B R2 U2 F L2\n"
		"B' D2 R2 B2 R2 F R2 F R2 F' U2 B R2 D2\n"
		"B' D2 R2 B2 R2 B U2 F U2 B' U2 B R2 D2\n"
		"B' D2 R2 B2 R2 B U2 B L2 B' L2 F R2 D2\n"
},
[4] = {
	.scramble = "B2 U2 D2 R2 F U2 D2 B2 R2 B' R2 F U2",
	.solutions =
		"U2 F' R2 B' D2 U2 B2 R2 F L2 D2 U2 F2\n"
		"U2 B' D2 B' R2 L2 B2 D2 B L2 D2 U2 F2\n"
		"L2 U2 B L2 F B2 D2 R2 D2 U2 B L2 F2\n"
		"U2 F' R2 B R2 B2 D2 U2 F' R2 D2 U2 B2\n"
		"U2 F' R2 B' D2 U2 F2 L2 F R2 D2 U2 B2\n"
		"L2 U2 F U2 B' D2 R2 D2 U2 F U2 F B\n"
},
[5] = {
	.scramble = "B D2 R2 B2 F' R2 U2 B R2 B' R2 F L2 U2",
	.solutions =
		"F2 D2 L2 F R2 B' U2 L2 B' D2 R2 F' D2 F'\n"
		"U2 L2 F' R2 F2 B' L2 B' D2 L2 F' R2 D2 B'\n"
		"U2 L2 F' R2 B R2 B' U2 R2 F B2 R2 D2 B'\n"
		"U2 L2 B' D2 B D2 F' U2 R2 F B2 R2 D2 B'\n"
},
[6] = {
	.scramble = "F2 R2 B' L2 B' D2 L2 B2 U2 F' U2 R2 F2",
	.solutions =
		"F2 R2 U2 F U2 B2 L2 D2 B L2 B R2 F2\n"
		"F2 R2 U2 B L2 B2 D2 R2 F L2 B R2 F2\n"
		"B2 L2 D2 B R2 F2 D2 R2 F L2 B R2 F2\n"
		"U2 F' R2 L2 U2 F U2 L2 B U2 F2 U2 R2\n"
},
[7] = {
	.scramble = "B2 L2 D2 B' U2 B R2 D2 B R2 U2 B2 R2 U2",
	.solutions =
		"U2 R2 F2 D2 L2 F' L2 D2 B' R2 F U2 R2 F2\n"
		"U2 R2 F2 D2 L2 B' U2 L2 B' D2 B U2 R2 F2\n"
		"U2 R2 B2 U2 R2 F' R2 U2 B' L2 F D2 L2 B2\n"
		"U2 R2 B2 U2 R2 B' D2 R2 B' U2 B D2 L2 B2\n"
		"U2 F D2 L2 F L2 B' D2 U2 R2 F' R2 B R2\n"
		"D2 F2 R2 U2 F D2 B L2 B R2 U2 R2 B2 U2\n"
		"D2 B2 L2 D2 F U2 B R2 B L2 D2 L2 F2 U2\n"
},
[8] = {
	.scramble = "B D2 L2 F2 R2 B' R2 B D2 B' L2 B' U2 F",
	.solutions =
		"U2 B' U2 R2 B2 R2 D2 B R2 D2 B' R2 U2 F'\n"
		"U2 B' D2 L2 F2 L2 U2 B R2 D2 B' R2 U2 F'\n"
		"U2 B' L2 D2 L2 U2 B2 D2 B' U2 L2 F L2 F'\n"
		"F' U2 B L2 B D2 B' R2 B R2 F2 L2 D2 B'\n"
		"B' R2 B U2 B L2 F' R2 B R2 F2 L2 D2 B'\n"
		"R2 U2 B D2 F2 L2 U2 B U2 F R2 B' R2 L2\n"
		"R2 D2 B' L2 F' L2 U2 B2 R2 F' L2 B' R2 L2\n"
		"U2 F2 R2 F R2 F L2 U2 F U2 F' D2 L2 D2\n"
		"U2 F D2 F L2 B2 L2 B' D2 U2 R2 B' D2 U2\n"
},
[9] = {
	.scramble = "R2 B2 L2 B L2 F' U2 R2 U2 B D2 F U2 D2 L2",
	.solutions =
		"L2 D2 U2 F R2 B D2 L2 D2 F' U2 B L2 B2 R2\n"
		"L2 D2 U2 F' D2 B' U2 R2 U2 F L2 B' L2 B2 R2\n"
		"L2 B L2 F D2 R2 D2 B' U2 F R2 F2 D2 U2 R2\n"
		"L2 B' D2 F' U2 L2 U2 B R2 F' R2 F2 D2 U2 R2\n"
		"R2 D2 U2 B R2 F U2 L2 U2 B' D2 F L2 F2 L2\n"
		"R2 D2 U2 B' U2 F' D2 R2 D2 B L2 F' L2 F2 L2\n"
		"R2 F L2 B U2 R2 U2 F' D2 B R2 B2 D2 U2 L2\n"
		"R2 F' U2 B' D2 L2 D2 F R2 B' R2 B2 D2 U2 L2\n"
},
[10] = {
	.scramble = "U2 B' D2 B L2 B2 R2 F' D2 F' R2 B R2 D2",
	.solutions =
		"D2 R2 F U2 B2 D2 F' L2 B' L2 F R2 F U2\n"
		"D2 R2 F U2 B2 D2 B' U2 B' U2 B R2 F U2\n"
		"D2 R2 B' R2 F D2 F R2 B2 L2 B' D2 B U2\n"
		"D2 R2 B' R2 F' D2 B2 U2 F L2 F R2 F U2\n"
		"D2 R2 B' R2 B R2 F U2 B2 D2 B' R2 F U2\n"
		"D2 R2 B' R2 B' L2 B2 R2 F U2 F D2 B U2\n"
		"L2 F2 R2 U2 B' U2 F' L2 F L2 B' D2 B U2\n"
		"L2 F2 R2 U2 B' U2 B' U2 F U2 F' D2 B U2\n"
},
[11] = {
	.scramble = "B U2 B' D2 R2 B R2 U2 R2 D2 F L2",
	.solutions =
		"L2 F' D2 R2 U2 R2 B' R2 D2 B U2 B'\n"
},
[12] = {
	.scramble = "D2 B' R2 F' L2 F D2 F L2 U2 D2 B R2",
	.solutions =
		"R2 B' D2 U2 L2 F' D2 F' L2 F R2 B D2\n"
},
[13] = {
	.scramble = "B L2 F R2 F2 L2 D2 B' R2 B D2 F2 D2 L2",
	.solutions =
		"L2 D2 F2 D2 B' R2 B D2 L2 F2 R2 F' L2 B'\n"
},
[14] = {
	.scramble = "B2 L2 U2 F' R2 B L2 F2 R2 F' R2 U2 F2",
	.solutions =
		"L2 F' B' R2 D2 B R2 B L2 F D2 R2 F2\n"
		"F' D2 F2 D2 F' U2 R2 L2 B U2 B' L2 B\n"
		"F' D2 F2 D2 B' R2 D2 U2 B R2 F' L2 B\n"
		"B D2 U2 L2 F' U2 B2 U2 F' R2 F' L2 B\n"
		"B' L2 F2 L2 F' R2 D2 U2 B R2 F' L2 B\n"
		"L2 F B L2 U2 B L2 B R2 F U2 L2 B2\n"
		"F2 U2 R2 F R2 F2 L2 B' R2 F U2 L2 B2\n"
},
[15] = {
	.scramble = "F2 R2 D2 B' U2 L2 B U2 F L2 U2 F L2",
	.solutions =
		"L2 F' U2 L2 F' U2 B' L2 U2 B D2 R2 F2\n"
},
[16] = {
	.scramble = "B U2 B U2 F' D2 F' U2 F2 D2 F' U2 L2 B'",
	.solutions =
		"F U2 R2 F' R2 F L2 F2 R2 B' D2 F' R2 F'\n"
		"B L2 U2 F D2 B2 D2 F U2 B R2 B' R2 F'\n"
		"B L2 U2 F' U2 B R2 B2 R2 F' R2 B' R2 F'\n"
		"B L2 U2 F' U2 B' R2 F' R2 B2 R2 B R2 F'\n"
		"R2 D2 F L2 B' D2 L2 U2 L2 F2 D2 F' U2 B'\n"
		"F U2 R2 B' D2 F U2 B2 U2 B' R2 F' U2 B'\n"
		"F' L2 F2 U2 R2 F L2 F' L2 F R2 F' U2 B'\n"
		"B L2 U2 F D2 F2 U2 F D2 F U2 B' U2 B'\n"
		"B L2 U2 F' U2 F' U2 F' U2 B2 U2 B U2 B'\n"
		"B' U2 F2 R2 D2 F U2 F' U2 B R2 F' U2 B'\n"
		"B' U2 F2 R2 D2 B L2 F' L2 F R2 F' U2 B'\n"
},
[17] = {
	.scramble = "B R2 B2 R2 U2 B L2 B2 D2 F L2 U2 B' D2 B'",
	.solutions =
		"U2 F R2 F L2 F B2 U2 F R2 F2 R2 D2 L2 F'\n"
		"U2 F2 B' D2 B L2 B' L2 B L2 B2 R2 D2 L2 F'\n"
		"U2 F' B2 L2 F R2 F' U2 F R2 F2 R2 D2 L2 F'\n"
		"U2 B U2 F' D2 B2 U2 F L2 B' R2 F2 D2 L2 F'\n"
		"F R2 B U2 R2 F U2 F2 R2 F L2 U2 B2 D2 F'\n"
		"F L2 F D2 R2 F' U2 B2 R2 F' R2 D2 B2 D2 F'\n"
		"B U2 F U2 R2 F' R2 F2 U2 F' L2 U2 B2 D2 F'\n"
		"B U2 F U2 R2 F' R2 B2 D2 F' R2 D2 F2 D2 F'\n"
		"B U2 B L2 U2 F' U2 F2 L2 B' L2 U2 B2 D2 F'\n"
		"B D2 F R2 U2 B' U2 B2 R2 F' R2 D2 B2 D2 F'\n"
		"B D2 B U2 L2 B' L2 F2 D2 B' L2 U2 F2 D2 F'\n"
		"B D2 B U2 L2 B' L2 B2 U2 B' R2 D2 B2 D2 F'\n"
		"U2 F R2 B D2 F B2 L2 F U2 F2 U2 R2 D2 B'\n"
		"U2 F2 B' D2 B L2 F' D2 B D2 B2 U2 R2 D2 B'\n"
		"U2 B U2 F' D2 F2 D2 F R2 F' D2 B2 R2 D2 B'\n"
		"U2 B U2 F' D2 B2 U2 F L2 F' U2 F2 R2 D2 B'\n"
		"U2 B U2 B R2 F' U2 F2 B' D2 B2 U2 R2 D2 B'\n"
		"U2 B U2 B' L2 F2 L2 B R2 F' D2 B2 R2 D2 B'\n"
		"F R2 F R2 D2 B' L2 F2 D2 B' D2 L2 B2 R2 B'\n"
		"F L2 B R2 U2 F' L2 B2 U2 F' U2 R2 B2 R2 B'\n"
		"B U2 F U2 R2 F U2 F2 R2 B D2 L2 B2 R2 B'\n"
		"B U2 F U2 R2 F U2 B2 L2 B U2 R2 F2 R2 B'\n"
		"B D2 B U2 L2 F' D2 F2 R2 B' D2 L2 F2 R2 B'\n"
		"B D2 B U2 L2 F' D2 B2 L2 B' U2 R2 B2 R2 B'\n"
},
[18] = {
	.scramble = "R2 B' R2 U2 B' U2 B' F2 R2 D2 F D2 F' U2",
	.solutions =
		"U2 R2 L2 F L2 F' U2 F2 B' U2 F' R2 F R2\n"
		"U2 F U2 F' D2 B L2 F B2 L2 D2 U2 F R2\n"
		"U2 F D2 F' D2 R2 F2 B U2 B U2 R2 B R2\n"
		"U2 B R2 F2 B U2 L2 F' L2 F U2 R2 B R2\n"
		"U2 B R2 F' R2 U2 F2 B L2 B L2 U2 F R2\n"
		"D2 R2 L2 F D2 F' U2 B R2 F B2 L2 F R2\n"
		"D2 F R2 F' D2 F2 B' D2 F' R2 D2 U2 F R2\n"
},
[19] = {
	.scramble = "D2 B' D2 B' D2 B' D2 R2 B' D2 F R2 B R2",
	.solutions =
		"R2 B' R2 F' D2 B R2 D2 B D2 B D2 B D2\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
