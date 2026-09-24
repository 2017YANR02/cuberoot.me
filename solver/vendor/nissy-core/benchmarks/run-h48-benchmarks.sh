#!/bin/sh

# This script must be run from the main repository folder.

scr="./benchmarks/scrambles"
out="./benchmarks/results_h48.py"

get_solve_time() {
	THREADS="$1" ./build.sh tool solve_file "$2" "$3" "$4" 0 | \
		tail -n 1 | sed 's/Total time: //; s/s$//'
}

do_all() {
	low=$1
	cutoff=$2
	high=$3
	t=$4
	n=$5
	name=$6
	
	printf '%s = {\n' "$name" >> "$out"
	for i in $(seq "$low" "$high"); do
		t17="$(get_solve_time $t h48h$i "$scr/scrambles-17.txt" $n)"
		t18="$(get_solve_time $t h48h$i "$scr/scrambles-18.txt" $n)"
		t19="$(get_solve_time $t h48h$i "$scr/scrambles-19.txt" $n)"
		printf '\t%s: {17: %s, 18: %s, 19: %s' $i $t17 $t18 $t19 >> "$out"
		if [ "$i" -ge "$cutoff" ]; then
			t20="$(get_solve_time $t h48h$i "$scr/scrambles-20.txt" $n)"
			tsf="$(get_solve_time $t h48h$i "$scr/superflip.txt" $n)"
			printf ', 20: %s, "superflip": %s},\n' $t20 $tsf >> "$out"
		else
			printf '},\n' >> "$out"
		fi
	done
	printf '}\n\n' >> "$out"
}

./build.sh clean && ./build.sh
printf '' > "$out"

do_all 6 10 11  1      1 "h48_single_thread"
do_all 6  9 11  4      1 "h48_4_threads"
do_all 6  9 11 16      1 "h48_16_threads"
do_all 6 10 11 16 999999 "h48_all_solutions"
