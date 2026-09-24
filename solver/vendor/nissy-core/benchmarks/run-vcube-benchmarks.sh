#!/bin/sh

# This script can be used to run benchmarks for vcube, similar to the
# benchmarks for H48 run by run-h48-benchmarks.sh. Before running this script,
# move it to the vcube folder and and adjust the paths below if necessary.

scr="../nissy-core/benchmarks/scrambles"
out="../nissy-core/benchmarks/results_vcube.py"

get_solve_time() {
	./vc-optimal -w "$1" -c "$2" <"$3" \
		2>&1 >/dev/null | sed 's/Total time: //; s/ real.*//'
}

do_all() {
	t=$1
	name=$2
	printf '%s = {\n' "$name" >> "$out"
	for i in 112 208 308 404 212 ; do
		t17="$(get_solve_time $t $i "$scr/scrambles-17.txt")"
		t18="$(get_solve_time $t $i "$scr/scrambles-18.txt")"
		t19="$(get_solve_time $t $i "$scr/scrambles-19.txt")"
		printf '\t%s: {17: %s, 18: %s, 19: %s' $i $t17 $t18 $t19 >> "$out"
		if [ "$i" -ge 212 ]; then
			t20="$(get_solve_time $t $i "$scr/scrambles-20.txt")"
			printf ', 20: %s' $t20 >> "$out"
			if [ "$t" = 1 ]; then
				tsf="$(get_solve_time $t $i "$scr/superflip.txt")"
				printf ', "superflip": %s},\n' $tsf >> "$out"
			else
				printf '},\n' >> "$out"
			fi
		else
			printf '},\n' >> "$out"
		fi
	done
	printf '}\n\n' >> "$out"
}

printf '' > "$out"

do_all 1 "vcube_single_thread"
do_all 4 "vcube_4_threads"
do_all 16 "vcube_16_threads"
