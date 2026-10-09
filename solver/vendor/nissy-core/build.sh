#!/bin/sh

# Build system for nissy, run './build.sh help' for info on how to use this.

# The variables below can be used to personalize the build system. For example,
# to compile with clang instead of the default cc one can use:
#
#   CC=clang ./build.sh
# 
# Each variable also has a counterpart that starts with NISSY_BUILD_*. These
# other variables can be set, for example, in your shell configuration file
# to change the default build options. They are still overwritten by the values
# of the non-NISSY_BUILD_* variables, if set.
# For example, on a system that supports the addressed and undefined behavior
# sanitizers, one can set
#
#   export NISSY_BUILD_SANITIZE="address,undefined"
#
# so that these sanitizers will be enabled when building nissy in debug mode.
# If later the same user wants to build a debug version without sanitizers,
# they may use
#
#   SANITIZE="" ./build.sh debug
#
# And the empty string value will take precedence.

# Specify the C compiler to use.
CC=${CC-${NISSY_BUILD_CC:-"cc"}}

# Specify the C++ compiler for the C++ examples.
CXX=${CXX-${NISSY_BUILD_CXX:-"c++"}}

# Specify the compiler to use when building for WASM.
EMCC=${EMCC-${NISSY_BUILD_EMCC:-"emcc"}}

# Specify the nodejs command for running tests for WASM.
NODE=${NODE-${NISSY_BUILD_NODE:-"node"}}

# The maximum number of threads to use for multi-threaded operations.
# This is also used as default value in case an operation allows
# specifying how many threads to use.
# The number n must be between 1 and 128.
# The default value is 16.
THREADS=${THREADS-${NISSY_BUILD_THREADS}}

portable_nproc() {
	OS="$(uname -s)"
	case "$OS" in
	"Linux")
		nproc
		;;
	"Darwin" | "*BSD")
		sysctl -n hw.ncpu
		;;
	*)
		echo "32" # A safe, large default
		;;
	esac
}

detectthreads() {
	echo "$(portable_nproc)"
}

[ -z "$THREADS" ] && THREADS="$(detectthreads)"

# You can use this variable to build for a different architecture, for example
# if you want to cross-compile or to use the portable version.
# The value must be one of "AVX2", "NEON", "PORTABLE". If the value is not
# specified, the script will automatically detect the best architecture for the
# system. The architecture "PORTABLE" will work on any system.
ARCH=${ARCH-${NISSY_BUILD_ARCH}}

greparch() {
	$CC -march=native -dM -E - </dev/null 2>/dev/null | grep "$1"
}

detectarch() {
	[ -n "$(greparch __AVX2__)" ] && detected="AVX2"
	[ -n "$(greparch __ARM_NEON)" ] && detected="NEON"
	[ -z "$detected" ] && detected="PORTABLE"
	echo "$detected"
}

[ -z "$ARCH" ] && ARCH="$(detectarch)"

# SANITIZE="option1,option2,..." adds the options "-fsanitize=option1",
# "-fsanitize=option2", ... to the C compiler command in debug mode.
# By default none is used because these options are not available on all
# systems. It is advisable to set the NISSY_BUILD_SANITIZE options in your
# shell's configuration file if your system does support them.
SANITIZE=${SANITIZE-${NISSY_BUILD_SANITIZE:-""}}

# Optimization flags.
OPTIMIZE=${OPTIMIZE-${NISSY_BUILD_OPTIMIZE:-"-O3"}}

validate_command() {
	command="$1"
	if ! (command -v "$command" >/dev/null 2>&1) ; then
		echo "Error: command '$command' not found"
		exit 1
	fi
}

validate_threads() {
	threads="$1"
	if [ "$threads" -le 0 ] || [ "$threads" -gt 128 ]; then
		echo "Error: number of threads must be between 1 and 128"
		exit 1
	fi
}

validate_arch() {
	arch="$1"
	case "$arch" in
	AVX2|NEON|PORTABLE)
		;;
	*)
		echo "Error: architecture '$arch' not supported"
		echo "Supported architectures: AVX2, NEON, PORTABLE"
		exit 1
		;;
	esac
}

parsesanitize() {
	# Use the user-specified comma-separated sanitizers
	for opt in $(echo "$1" | tr ',' '\n'); do
		printf -- '-fsanitize=%s ' "$opt"
	done
}

maybe_pthread() {
	if [ "$THREADS" -gt 1 ]; then
		echo "-pthread"
	else
		echo ""
	fi
}

# Build flags
CFLAGS="-std=c11 -fPIC -D_POSIX_C_SOURCE=199309L $(maybe_pthread)"
PYCFLAGS="-std=c11 -fPIC $(maybe_pthread)"
[ "$ARCH" = "AVX2" ] && CFLAGS="$CFLAGS -mavx2"
WFLAGS="-pedantic -Wall -Wextra -Wno-unused-parameter -Wno-unused-function"
OFLAGS="$OPTIMIZE"
DFLAGS="-DDEBUG -g3 $(parsesanitize "$SANITIZE")"
MFLAGS="-DTHREADS=$THREADS -D$ARCH"
CPPFLAGS="-std=c++20 $(maybe_pthread)"

# TODO:
# MEMORY64 is supported on Firefox (from version 134) and Chrome (from 133),
# but not on Safari (nor on e.g. Firefox 128 ESR, current default on Debian).
# See also https://webassembly.org/features
# When it becomes widely available, we can support it by adding -sMEMORY64
# to the WASMCFLAGS, WASMCPPFLAGS and WASMLINKFLAGS variables below, and
# -sMAXIMUM_MEMORY=10737418240 to WASMLINKFLAGS. This way we can enable
# solvers larger than h48h6 in the web version.

# TODO:
# The options below have to be adjusted when native WASM_SIMD is implemented.

# Build flags for emscripten (WASM target)
WASMCFLAGS="-std=c11 -fPIC -D_POSIX_C_SOURCE=199309L $(maybe_pthread)"
WASMCPPFLAGS="-std=c++20 $(maybe_pthread)"
WASMDBGFLAGS="-sASSERTIONS"
WASMMFLAGS="-DTHREADS=$THREADS -DPORTABLE"
WASMLINKFLAGS="--no-entry -sEXPORT_NAME='Nissy' -sMODULARIZE 
	-sEXPORTED_RUNTIME_METHODS=addFunction,UTF8ToString
	-sALLOW_TABLE_GROWTH
	-sALLOW_MEMORY_GROWTH -sSTACK_SIZE=5MB -sPTHREAD_POOL_SIZE=$THREADS
	-sFETCH -sASYNCIFY -sLINKABLE -sEXPORT_ALL"

if (command -v "python3-config" >/dev/null 2>&1) ; then
	PYTHON3_INCLUDES="$(python3-config --includes)"
	PYTHON3="version $(echo "$PYTHON3_INCLUDES" | sed 's/.*3\./3./')"
else
	PYTHON3_INCLUDES=""
	PYTHON3="Not found, Python shell won't be available"
fi

build_help() {
	echo "Build system for nissy. Usage:"
	echo ""
	echo "$0 [-d] [TARGET]"
	echo ""
	echo "Possible values for TARGET (defaults to 'nissy' if unspecified):"
	echo ""
	echo "nissy          Build the nissy.o object file."
	echo "lib            Build the static library libnissy.a."
	echo "sharedlib      Build the shared library libnissy.so."
	echo "python         Build the Python module for nissy."
	echo "shell          Build a basic nissy shell (./run)."
	echo "web            Build the WebAssembly module for nissy."
	echo "cpp FILES      Build and run the given C++ FILES."
	echo "test [EXPR]    Build and run unit tests. If EXPR is provided,"
        echo "               only the tests whose name matches EXPR are run."
        echo "               The -d option is always implied."
	echo "webtest [EXPR] Same as test, but for WebAssembly build."
	echo "tool EXPR      Run the 'tool' matching the given EXPR."
	echo "solvetest      Build nissy and run a collection of tools for"
	echo "               testing various solvers."
	echo "help           Show this help message."
	echo "config         Show build configuration and exit."
	echo "clean          Remove all build files."
	echo ""
	echo "The -d option activates debug mode (slower, used for testing)."
	echo "Tests are automatically built in debug mode even without -d."
	echo "For more on build configurations, see the comments in ./build.sh"
}

build_config() {
	echo "Compiler: $CC"
	echo "Architecture: $ARCH"
	echo "Max threads: $THREADS"
	echo "Optimization options: $OFLAGS"
	echo "Debug flags: $DFLAGS"
	echo ""

	echo "Optional features:"

	printf '%s' "WASM compiler: "
	if (validate_command "$EMCC" >/dev/null); then
		echo "$EMCC"
	else
		echo "Not found, web target won't be available"
	fi
	
	printf '%s' "nodejs executable: "
	if (validate_command "$NODE" >/dev/null); then
		echo "$NODE"
	else
		echo "Not found, unit tests won't be available for web target"
	fi

	echo "Python bindings: $PYTHON3"
}

run() {
	echo "$@"
	$@
}

odflags() {
	if [ "$debug" = "yes" ]; then
		echo "$DFLAGS"
	else
		echo "$OFLAGS"
	fi
}

build_clean() {
	run rm -rf -- *.o *.so *.a run runtest runtool runcpp \
	    web/nissy_web_module.* web/http/nissy_web_module.*
}

build_nissy() {
	validate_command "$CC"
	validate_threads "$THREADS"
	validate_arch "$ARCH"

	run $CC $CFLAGS $WFLAGS $MFLAGS $(odflags) -c -o nissy.o src/nissy.c
}

build_lib() {
	build_nissy
	run ar rcs libnissy.a nissy.o
}

build_sharedlib() {
	validate_command "$CC"
	validate_threads "$THREADS"
	validate_arch "$ARCH"

	run $CC $CFLAGS $WFLAGS $MFLAGS $(odflags) -shared -c -o nissy.o \
		src/nissy.c
}

build_shell() {
	build_nissy || exit 1
	run $CC $CFLAGS $WFLAGS $(odflags) -o run nissy.o shell/shell.c
}

build_python() {
	if [ -z "$PYTHON3_INCLUDES" ]; then
		echo "Python3 development headers could not be located"
		echo "Cannot build python module"
		exit 1
	fi
	if [ "$debug" = "yes" ]; then
		echo "Cannot build Python library in debug mode"
		exit 1
	fi
	build_nissy || exit 1
	run $CC $PYCFLAGS $WFLAGS $PYTHON3_INCLUDES $OFLAGS -shared \
		-o python/nissy.so nissy.o python/nissy_module.c
}

build_cpp() {
	validate_command "$CXX"
	if [ -z "$@" ]; then
		echo "Please provide one or more valid C++ source files"
		echo "usage: ./build.sh cpp FILES"
	fi

	build_nissy || exit 1
	run $CXX $(odflags) -std=c++20 -o runcpp cpp/nissy.cpp nissy.o $@ \
		|| exit 1
	run ./runcpp
}

build_web() {
	validate_command "$EMCC"
	validate_threads "$THREADS"
	validate_arch "$ARCH"

	obj="nissy_web_module"

	if [ "$debug" = "yes" ]; then
		ODFLAGS="$DFLAGS -sASSERTIONS"
	else
		ODFLAGS="$OFLAGS"
	fi

	run $EMCC $WASMCFLAGS $WFLAGS $WASMMFLAGS $ODFLAGS -c \
		-o nissy.o src/nissy.c || exit 1
	run $EMCC -lembind -lidbfs.js \
		$WASMCPPFLAGS $ODFLAGS $WASMLINKFLAGS -o web/"$obj".mjs \
		cpp/nissy.cpp web/storage.cpp web/adapter.cpp nissy.o || exit 1
	cp web/"$obj".mjs web/http/
	cp web/"$obj".wasm web/http/
}

dotest() {
	testout="test/last.out"
	testerr="test/last.err"

	# Verify that $t is a directory and it starts with three digits
	if [ ! -d "$t" ] || ! (basename "$t" | grep -Eq '^[0-9]{3}'); then
		return 0
	fi

	# Verify that the test is selected by the given pattern
	if [ -n "$pattern" ] && ! (echo "$t" | grep -q "$pattern"); then
		return 0
	fi

	$testbuild "$t"/*.c nissy.o || exit 1
	for cin in "$t"/*.in; do
		c="$(echo "$cin" | sed 's/\.in//')"
		cout="$c.out"
		printf '%s: ' "$c"
		$testrun < "$cin" > "$testout" 2> "$testerr"
		if diff "$cout" "$testout"; then
			printf "OK\n"
		else
			printf "Test failed! stderr:\n"
			cat "$testerr"
			exit 1
		fi
	done
}

build_test_generic() {
	if [ -n "$1" ]; then
		pattern="$1"
		shift
	fi
	debug="yes"
	build_$obj || exit 1
	for t in test/*; do
		dotest || exit 1
	done
	echo "All tests passed!"
}

build_test() {
	obj="nissy"
	testobj="runtest"
	testbuild="$CC $CFLAGS $WFLAGS $DFLAGS $MFLAGS -o $testobj"
	testrun="./$testobj"
	build_test_generic $@
	rm -f runtest
}

build_webtest() {
	obj="web"
	testobj="runtest.js"
	testbuild="$EMCC $WASMCFLAGS $WFLAGS $WASMMFLAGS $DFLAGS \
		   -sSTACK_SIZE=5MB -o $testobj"
	testrun="$NODE $testobj"
	build_test_generic $@
	rm -f runtest.js runtest.wasm
}

run_single_tool() {
	results="tools/results"
	last="$results/last.out"
	date="$(date +'%Y-%m-%d-%H-%M-%S')"
	file="$results/$toolname-$date.txt"
	failed="tools/failed"

	$CC $CFLAGS $WFLAGS $MFLAGS $(odflags) -o runtool "$t"/*.c nissy.o \
		|| exit 1

	(
		date +'%Y-%m-%d %H:%M'
		echo ""
		echo "=========== Running tool  ==========="
		echo "tool name: $toolname"
		echo ""
		echo "======== nissy build command ========"
		echo "$CC $CFLAGS $WFLAGS $MFLAGS $(odflags)"
		echo ""
		echo "======== tool build command  ========"
		echo "$CC $CFLAGS $WFLAGS $MFLAGS $(odflags)"
		echo ""
		echo "============ tool output ============"
		./runtool $@ || touch "$failed"
	) | tee "$file" "$last"

	rm -f runtool
	if [ -f "$failed" ]; then
		rm "$failed"
		exit 1
	fi
}

build_tool() {
	pattern="$1"

	if [ -z "$pattern" ]; then
		echo "Please provide a valid PATTERN to select a tool"
		echo "usage: ./build.sh tool PATTERN"
		exit 1
	fi
	shift

	# Select a single tool matched by the given pattern
	for t in tools/*; do
		if [ -d "$t" ] && (echo "$t" | grep -q "$pattern"); then
			toolname="$(basename "$t" .c)"
			break
		fi
	done
	if [ -z "$toolname" ]; then
		echo "pattern '$pattern' does not match any tool"
		exit 1
	fi

	build_nissy || exit 1
	run_single_tool $@
}

build_solvetest() {
	build_nissy || exit 1
	for t in tools/*; do
		if [ -d "$t" ] && (echo "$t" | grep -q "solvetest"); then
			toolname="$(basename "$t" .c)"
			run_single_tool || exit 1
		fi
	done
}

if [ "$1" = "-d" ]; then
	debug="yes"
	shift
fi

target="$1"
if [ -z "$target" ]; then
	target="nissy"
else
	shift
fi

case "$target" in
help|config|clean|\
nissy|lib|sharedlib|shell|python|cpp|web|test|webtest|tool|solvetest)
	mkdir -p tables tools/results
	(build_"$target" $@) || exit 1
	exit 0
	;;
*)
	echo "Target '$target' unavailable, run '$0 help' for info"
	exit 1
	;;
esac
