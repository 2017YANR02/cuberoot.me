#ifndef SOLVERS_TABLES_H
#define SOLVERS_TABLES_H

STATIC uint64_t read_unaligned_u64(
    const unsigned char [SIZE(sizeof(uint64_t))]);
STATIC void write_unaligned_u64(
    unsigned char [SIZE(sizeof(uint64_t))], uint64_t);
STATIC int64_t readtableinfo(
    size_t, const unsigned char *, tableinfo_t [NON_NULL]);
STATIC int64_t readtableinfo_n(
    size_t, const unsigned char *, uint8_t, tableinfo_t [NON_NULL]);
STATIC int64_t writetableinfo(
    const tableinfo_t [NON_NULL], size_t, unsigned char *);
STATIC void append_name(tableinfo_t [NON_NULL], const char *);

STATIC uint64_t
read_unaligned_u64(const unsigned char buf[SIZE(sizeof(uint64_t))])
{
	uint64_t ret;

	memcpy(&ret, buf, sizeof(uint64_t));

	return ret;
}

STATIC void
write_unaligned_u64(unsigned char buf[SIZE(sizeof(uint64_t))], uint64_t x)
{
	memcpy(buf, &x, sizeof(uint64_t));
}

STATIC int64_t
readtableinfo(
	size_t buf_size,
	const unsigned char *buf,
	tableinfo_t info[NON_NULL]
)
{
	size_t i;

	if (buf == NULL) {
		LOG("Error reading table: buffer is NULL\n");
		return NISSY_ERROR_NULL_POINTER;
	}

	if (buf_size < INFOSIZE) {
		LOG("Error reading table: buffer size is too small "
		    "(given size %zu is smaller than INFOSIZE = %"
		    PRId64 ")\n", buf_size, INFOSIZE);
		return NISSY_ERROR_BUFFER_SIZE;
	}

	for (i = 0; i < INFO_DISTRIBUTION_LEN; i++)
		info->distribution[i] = read_unaligned_u64(OFFSET(buf,
		    INFO_OFFSET_DISTRIBUTION + i * sizeof(uint64_t)));

	info->type = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_TYPE));
	info->infosize = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_INFOSIZE));
	info->fullsize = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_FULLSIZE));
	info->hash = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_HASH));
	info->entries = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_ENTRIES));
	info->classes = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_CLASSES));
	info->next = read_unaligned_u64(OFFSET(buf, INFO_OFFSET_NEXT));

	memcpy(info->solver, OFFSET(buf, INFO_OFFSET_SOLVER),
	    INFO_SOLVER_STRLEN);

	info->h48h = *(uint8_t *)OFFSET(buf, INFO_OFFSET_H48H);
	info->bits = *(uint8_t *)OFFSET(buf, INFO_OFFSET_BITS);
	info->base = *(uint8_t *)OFFSET(buf, INFO_OFFSET_BASE);
	info->maxvalue = *(uint8_t *)OFFSET(buf, INFO_OFFSET_MAXVALUE);

	return NISSY_OK;
}

STATIC int64_t
readtableinfo_n(
	size_t buf_size,
	const unsigned char *buf,
	uint8_t n,
	tableinfo_t info[NON_NULL]
)
{
	int64_t ret;

	for (; n > 0; n--, buf = buf + info->next, buf_size -= info->next)
		if ((ret = readtableinfo(buf_size, buf, info)) != 0)
			return ret;

	return NISSY_OK;
}

STATIC int64_t
writetableinfo(
	const tableinfo_t info[NON_NULL],
	size_t data_size,
	unsigned char *buf
)
{
	size_t i;
	bool end;
	unsigned char *c;

	if (data_size < info->fullsize) {
		LOG("Error writing table: buffer size is too small "
		    "(given %zu but table requires %" PRId64 ")\n",
		    data_size, info->fullsize);
		return NISSY_ERROR_BUFFER_SIZE;
	}

	for (i = 0; i < INFO_DISTRIBUTION_LEN; i++)
		write_unaligned_u64(OFFSET(buf, INFO_OFFSET_DISTRIBUTION +
		    i * sizeof(uint64_t)), info->distribution[i]);

	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_TYPE), info->type);
	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_INFOSIZE), info->infosize);
	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_FULLSIZE), info->fullsize);
	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_HASH), info->hash);
	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_ENTRIES), info->entries);
	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_CLASSES), info->classes);
	write_unaligned_u64(OFFSET(buf, INFO_OFFSET_NEXT), info->next);

	memcpy(OFFSET(buf, INFO_OFFSET_SOLVER), info->solver,
	    INFO_SOLVER_STRLEN);

	/* Zeroing all chars after the end of the string, for consistency */
	end = false;
	for (i = 0; i < INFO_SOLVER_STRLEN; i++) {
		c = OFFSET(buf, INFO_OFFSET_SOLVER + i);
		end = end || *c == 0;
		if (end)
			*c = 0;
	}

	*OFFSET(buf, INFO_OFFSET_H48H) = (unsigned char)info->h48h;
	*OFFSET(buf, INFO_OFFSET_BITS) = (unsigned char)info->bits;
	*OFFSET(buf, INFO_OFFSET_BASE) = (unsigned char)info->base;
	*OFFSET(buf, INFO_OFFSET_MAXVALUE) = (unsigned char)info->maxvalue;

	return NISSY_OK;
}

STATIC void
append_name(tableinfo_t info[NON_NULL], const char *str)
{
	size_t i, j;

	for (i = 0, j = strlen(info->solver); str[i] != '\0'; i++, j++)
		info->solver[j] = str[i];

	info->solver[j] = '\0';
}

#endif /* SOLVERS_TABLES_H */
