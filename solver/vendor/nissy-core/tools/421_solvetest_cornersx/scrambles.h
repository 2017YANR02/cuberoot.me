struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "R2 D' F2 B D L2 U L U2 R' D' F2 B2 U F2 D F2 U' L2 D' F2",
	.solutions =
		"U R U2 F' U R2 U R F'\n"
		"U R U' R F R2 F U' F2\n"
		"U2 R' U F' U F' U R' U2\n"
		"U R2 U2 F U R' U' F U' F2\n"
		"U2 F R' F' R2 F' U' F2 U' R\n"
		"U2 F2 R F' R' U' R U2 F R'\n"
		"U2 F2 R' U R2 F R' F' U' R\n"
		"U' F U2 R2 F2 U' F U F' R\n"
		"U' F' U2 R2 U' R' U' F U' F2\n"
		"U' F' U2 R2 F2 U F U F' R\n"
		"R2 U F2 U' R U' F U' R' F2\n"
		"F' U F2 U F U' F2 R F' U2\n"
		"F' R' F R' F R' U' R' U' F2\n"
},
/*
TODO: add more scrambles, use https://or18.github.io/RubiksSolverDemo/2x2x2
to generate test cases.
*/
{
	.scramble = "", /* End-of-list signal */
}
};
