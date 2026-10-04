// WCA's DatabaseDumper.mysqldump_tsv uses mysql --batch --quick, without --raw:
// https://github.com/thewca/worldcubeassociation.org/blob/main/lib/database_dumper.rb
// MySQL escapes NUL, newline, tab and backslash. Decode exactly once; unknown
// escapes remain intact so invalid scramble text is not silently accepted.
const ESCAPES = { '0': '\0', n: '\n', t: '\t', '\\': '\\' };

/** @param {string} value @returns {string} */
export function decodeWcaTsvField(value) {
  return value.replace(/\\([0nt\\])/g, (_, escaped) => ESCAPES[escaped]);
}
