#!/bin/sh

if [ -z "$1" ]; then
	echo "Usage: $0 [file]"
	exit 1
fi

guard="$(echo "$1" | sed 's/^\.\///' | tr 'a-z/.' 'A-Z__')"

new_file="$1.adding_include_guard"
printf '#ifndef %s\n#define %s\n\n' "$guard" "$guard" > "$new_file"
cat "$1" >> "$new_file"
printf '\n#endif /* %s */\n' "$guard" >> "$new_file"

mv "$new_file" "$1"
