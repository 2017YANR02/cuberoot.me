#!/bin/sh

# use like e.g.
# nissy scramble -n 20 | ./utils/solvetest_gen.sh eofb -o -N | \
#     tee tools/401_solvetest_opt0_EO_FB/scrambles.h

args="$@"

getsolutions() {
	nissy solve -p $args "$1" |
	while read -r solution; do
		printf '\t\t"%s\\n"\n' "$solution"
	done
}

printf "struct {\n\tchar *scramble;\n\tchar *solutions;\n} s[] = {\n"

i=0
while read -r scramble; do
	solutions="$(getsolutions "$scramble")"
	printf '[%s] = {\n\t.scramble = "%s",\n' "$i" "$scramble"
	printf '\t.solutions =\n%s\n' "$solutions"
	printf '},\n'
	i=$((i+1))
done

printf '{\n\t.scramble = "", /* End-of-list signal */\n}\n};\n'
