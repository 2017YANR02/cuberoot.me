/*
This file contains code related to cube format conversion that used to
be in src/core.  It is to be adapted into a standalone tool for cube
format conversion.
*/

STATIC cube_t readcube(const char *, const char *);
STATIC int64_t writecube(const char *, cube_t, size_t n, char [n]);
STATIC void log_available_formats(void);
STATIC uint8_t readco(const char *);
STATIC uint8_t readcp(const char *);
STATIC uint8_t readeo(const char *);
STATIC uint8_t readep(const char *);
STATIC cube_t readcube_B32(const char *);
STATIC cube_t readcube_H48(const char *);
STATIC uint8_t readpiece_LST(const char **);
STATIC cube_t readcube_LST(const char *);

STATIC int64_t writepiece_LST(uint8_t, size_t n, char [n]);
STATIC int64_t writecube_B32(cube_t, size_t n, char [n]);
STATIC int64_t writecube_H48(cube_t, size_t n, char [n]);
STATIC int64_t writecube_LST(cube_t, size_t n, char [n]);

STATIC uint8_t b32toedge(char);
STATIC uint8_t b32tocorner(char);
STATIC char edgetob32(uint8_t);
STATIC char cornertob32(uint8_t);

STATIC struct {
	const char *name;
	cube_t (*read)(const char *);
	int64_t (*write)(cube_t, size_t n, char [n]);
} ioformat[] =
{
	{ .name = "B32", .read = readcube_B32, .write = writecube_B32 },
	{ .name = "LST", .read = readcube_LST, .write = writecube_LST },
	{ .name = "H48", .read = readcube_H48, .write = writecube_H48 },
	{ .name = "NONE", .read = NULL, .write = NULL },
};

STATIC cube_t
readcube(const char *format, const char *buf)
{
	int i;

	for (i = 0; ioformat[i].read != NULL; i++)
		if (!strcmp(format, ioformat[i].name))
			return ioformat[i].read(buf);

	LOG("Cannot read cube: unknown format '%s'\n", format);
	log_available_formats();
	return ZERO_CUBE;
}

STATIC int64_t
writecube(const char *format, cube_t cube, size_t buf_size, char buf[buf_size])
{
	int i;

	for (i = 0; ioformat[i].write != NULL; i++)
		if (!strcmp(format, ioformat[i].name))
			return ioformat[i].write(cube, buf_size, buf);

	LOG("Cannot write cube: unknown format '%s'\n", format);
	log_available_formats();
	return NISSY_ERROR_INVALID_FORMAT;
}

STATIC void
log_available_formats(void)
{
	int i;

	LOG("Available formats: ");
	for (i = 0; ioformat[i].read != NULL; i++)
		LOG("'%s' ", ioformat[i].name);
	LOG("\n");
}

STATIC uint8_t
readco(const char *str)
{
	if (*str == '0')
		return 0;
	if (*str == '1')
		return CTWIST_CW;
	if (*str == '2')
		return CTWIST_CCW;

	LOG("Error reading CO\n");
	return UINT8_ERROR;
}

STATIC uint8_t
readcp(const char *str)
{
	uint8_t c;

	for (c = 0; c < 8; c++)
		if (!strncmp(str, cornerstr[c], 3) ||
		    !strncmp(str, cornerstralt[c], 3))
			return c;

	LOG("Error reading CP\n");
	return UINT8_ERROR;
}

STATIC uint8_t
readeo(const char *str)
{
	if (*str == '0')
		return 0;
	if (*str == '1')
		return EFLIP;

	LOG("Error reading EO\n");
	return UINT8_ERROR;
}

STATIC uint8_t
readep(const char *str)
{
	uint8_t e;

	for (e = 0; e < 12; e++)
		if (!strncmp(str, edgestr[e], 2))
			return e;

	LOG("Error reading EP\n");
	return UINT8_ERROR;
}

STATIC cube_t
readcube_B32(const char *buf)
{
	int i;
	uint8_t c[8], e[12];

	for (i = 0; i < 8; i++) {
		c[i] = b32tocorner(buf[i]);
		if (c[i] == UINT8_ERROR) {
			LOG("Error reading B32 corner %d ", i);
			if (buf[i] == 0) {
				LOG("(string terminated early)\n");
			} else {
				LOG("(char '%c')\n", buf[i]);
			}
			return ZERO_CUBE;
		}
	}

	if (buf[8] != '=') {
		LOG("Error reading B32 separator: a single '=' "
		    "must be used to separate edges and corners\n");
		return ZERO_CUBE;
	}

	for (i = 0; i < 12; i++) {
		e[i] = b32toedge(buf[i+9]);
		if (e[i] == UINT8_ERROR) {
			LOG("Error reading B32 edge %d ", i);
			if (buf[i+9] == 0) {
				LOG("(string terminated early)\n");
			} else {
				LOG("(char '%c')\n", buf[i+9]);
			}
			return ZERO_CUBE;
		}
	}

	return cubefromarray(c, e);
}

STATIC cube_t
readcube_H48(const char *buf)
{
	int i;
	uint8_t piece, orient, c[8], e[12];
	const char *b;
	
	b = buf;

	for (i = 0; i < 12; i++) {
		while (*b == ' ' || *b == '\t' || *b == '\n')
			b++;
		if ((piece = readep(b)) == UINT8_ERROR)
			return ZERO_CUBE;
		b += 2;
		if ((orient = readeo(b)) == UINT8_ERROR)
			return ZERO_CUBE;
		b++;
		e[i] = piece | orient;
	}
	for (i = 0; i < 8; i++) {
		while (*b == ' ' || *b == '\t' || *b == '\n')
			b++;
		if ((piece = readcp(b)) == UINT8_ERROR)
			return ZERO_CUBE;
		b += 3;
		if ((orient = readco(b)) == UINT8_ERROR)
			return ZERO_CUBE;
		b++;
		c[i] = piece | orient;
	}

	return cubefromarray(c, e);
}

STATIC uint8_t
readpiece_LST(const char **b)
{
	uint8_t ret;
	bool read;

	while (**b == ',' || **b == ' ' || **b == '\t' || **b == '\n')
		(*b)++;

	for (ret = 0, read = false; **b >= '0' && **b <= '9'; (*b)++) {
		read = true;
		ret = ret * 10 + (**b) - '0';
	}

	return read ? ret : UINT8_ERROR;
}

STATIC cube_t
readcube_LST(const char *buf)
{
	int i;
	uint8_t c[8], e[12];

	for (i = 0; i < 8; i++)
		c[i] = readpiece_LST(&buf);

	for (i = 0; i < 12; i++)
		e[i] = readpiece_LST(&buf);

	return cubefromarray(c, e);
}

STATIC int64_t
writepiece_LST(uint8_t piece, size_t buf_size, char buf[buf_size])
{
	char digits[3];
	size_t i, len;

	if (piece > 99 || buf_size < 3)
		return 0;

	len = 0;
	while (piece != 0) {
		digits[len++] = (piece % 10) + '0';
		piece /= 10;
	}

	if (buf_size < len+2)
		return 0;

	if (len == 0)
		digits[len++] = '0';

	for (i = 0; i < len; i++)
		buf[i] = digits[len-i-1];

	buf[len] = ',';
	buf[len+1] = ' ';

	return len+2;
}

STATIC int64_t
writecube_B32(cube_t cube, size_t buf_size, char buf[buf_size])
{
	int i;
	uint8_t corner[8], edge[12];

	if (buf_size < NISSY_SIZE_B32) {
		LOG("Cannot write cube in B32 format: buffer size must be at "
		    "least %u bytes, but the provided one is %zu bytes.\n",
		    NISSY_SIZE_B32, buf_size);
		return NISSY_ERROR_BUFFER_SIZE;
	}

	pieces(&cube, corner, edge);

	for (i = 0; i < 8; i++)
		buf[i] = cornertob32(corner[i]);

	buf[8] = '=';

	for (i = 0; i < 12; i++)
		buf[i+9] = edgetob32(edge[i]);

	buf[21] = '\0';

	return NISSY_OK;
}

STATIC int64_t
writecube_H48(cube_t cube, size_t buf_size, char buf[buf_size])
{
	uint8_t piece, perm, orient, corner[8], edge[12];
	int i;

	if (buf_size < NISSY_SIZE_H48) {
		LOG("Cannot write cube in H48 format: buffer size must be "
		    "at least %u bytes, but the provided one is %zu bytes.\n",
		    NISSY_SIZE_H48, buf_size);
		return NISSY_ERROR_BUFFER_SIZE;
	}

	pieces(&cube, corner, edge);

	for (i = 0; i < 12; i++) {
		piece = edge[i];
		perm = piece & PBITS;
		orient = (piece & EOBIT) >> EOSHIFT;
		buf[4*i    ] = edgestr[perm][0];
		buf[4*i + 1] = edgestr[perm][1];
		buf[4*i + 2] = orient + '0';
		buf[4*i + 3] = ' ';
	}
	for (i = 0; i < 8; i++) {
		piece = corner[i];
		perm = piece & PBITS;
		orient = (piece & COBITS) >> COSHIFT;
		buf[48 + 5*i    ] = cornerstr[perm][0];
		buf[48 + 5*i + 1] = cornerstr[perm][1];
		buf[48 + 5*i + 2] = cornerstr[perm][2];
		buf[48 + 5*i + 3] = orient + '0';
		buf[48 + 5*i + 4] = ' ';
	}

	buf[48+39] = '\0';

	return NISSY_OK;
}

STATIC int64_t
writecube_LST(cube_t cube, size_t buf_size, char buf[buf_size])
{
	int i;
	uint64_t ptr;
	uint8_t piece, corner[8], edge[12];

	ptr = 0;
	pieces(&cube, corner, edge);

	for (i = 0; i < 8; i++) {
		piece = corner[i];
		ptr += writepiece_LST(piece, buf_size - ptr, buf + ptr);
		if (ptr == 0)
			goto writecube_LST_error;
	}

	for (i = 0; i < 12; i++) {
		piece = edge[i];
		ptr += writepiece_LST(piece, buf_size - ptr, buf + ptr);
		if (ptr == 0)
			goto writecube_LST_error;
	}

	*(buf+ptr-2) = '\0';

	return NISSY_OK;

writecube_LST_error:
	LOG("Cannot write cube in LST: buffer is too small (%" PRIu64
	    " bytes given). The LST format has a variable size, try a "
	    "larger buffer.\n", buf_size);
	return NISSY_ERROR_BUFFER_SIZE;
}

STATIC uint8_t
b32toedge(char c)
{
	if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'f')))
		return UINT8_ERROR;

	return c <= 'Z' ? (uint8_t)(c - 'A') : (uint8_t)(c - 'a') + 26;
}

STATIC uint8_t
b32tocorner(char c) {
	uint8_t val;

	if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'f')))
		return UINT8_ERROR;

	val = c <= 'Z' ? (uint8_t)(c - 'A') : (uint8_t)(c - 'a') + 26;

	return (val & 7) | ((val & 24) << 2);
}

STATIC char
edgetob32(uint8_t edge)
{
	return edge < 26 ? 'A' + (char)edge : 'a' + (char)(edge - 26);
}

STATIC char
cornertob32(uint8_t corner)
{
	uint8_t val;

	val = (corner & 7) | ((corner & 96) >> 2);

	return val < 26 ? 'A' + (char)val : 'a' + (char)(val - 26);
}
