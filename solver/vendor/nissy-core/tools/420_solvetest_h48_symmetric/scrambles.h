struct {
	char *scramble;
	char *solutions;
} s[] = {
[0] = {
	.scramble = "M2 E2 S2",
	.solutions =
		"U2 D2 F2 B2 R2 L2\n"
		"U2 D2 R2 L2 F2 B2\n"
		"R2 L2 U2 D2 F2 B2\n"
		"R2 L2 F2 B2 U2 D2\n"
		"F2 B2 U2 D2 R2 L2\n"
		"F2 B2 R2 L2 U2 D2\n"
},
{
	.scramble = "", /* End-of-list signal */
}
};
