#!/bin/sh

# A simple script to run commands (e.g. build commands) in a Docker container.
# It can be used for testing on platforms different from the host. For example,
# the command
# 
# ./container-run.sh arm ./build.sh test
#
# builds nissy and runs the unit tests in an ARM container.
#
# The containers are based on Alpine Linux and the contain the necessary tools
# to build the main library and the C++ and Python examples. They DO NOT
# contain the emscripten compiler, so they cannot be used to build the web
# version (e.g. ./build.sh web or ./build.sh webtest).
# The images are given a tag starting with 'localhost/nissy/'.
#
# See below for a list of options.

usage() {
	echo "$1"
	echo ""
	echo "usage: $0 PLATFORM [COMMAND]"
	echo ""
	echo "If COMMAND is unspecified, an interactive shell will be opened."
	echo ""
	echo "Available platforms:"
	echo "x86        (equivalent to: x86_64, amd64)"
	echo "arm        (equivalent to: arm64)"
	echo "emscripten"
	echo ""
	echo "Examples:"
	echo "$0 ram ./build.sh test   # Run unit tests in arm container"
	exit 1
}

if [ -z "$1" ]; then
	usage "No platform given."
fi

config_standard() {
	image="localhost/nissy/alpine-$1"
	platform="--platform=linux/$1"
	mount="--mount type=bind,src=./,dst=/nissy-core"
	flags="--rm --privileged"

	dockerfile="$(mktemp)"
	cat > "$dockerfile" << EOF
	FROM alpine:3.22
	RUN apk update
	RUN apk add gcc g++ clang python3 python3-dev
	RUN mkdir /nissy-core
	WORKDIR /nissy-core
	USER 1000:1000
EOF
}

config_emscripten() {
	image="localhost/nissy/emscripten"
	platform="--platform=linux/amd64"
	mount="--mount type=bind,src=./,dst=/nissy-core"
	flags="--rm --privileged"

	dockerfile="$(mktemp)"
	cat > "$dockerfile" << EOF
	FROM emscripten/emsdk
	WORKDIR /nissy-core
	USER 1000:1000
EOF
}

case "$1" in
x86|x86_64|amd64)
	config_standard amd64
	shift
	;;
arm|arm64)
	config_standard arm64
	shift
	;;
emscripten)
	config_emscripten
	shift
	;;
*)
	usage "Platform '$1' not available."
	;;
esac

docker build "$platform" -f "$dockerfile" -t "$image" .
rm "$dockerfile"

if [ -z "$1" ]; then 
	docker run $flags $mount "$platform" -it "$image" /bin/sh
else
	docker run $flags $mount "$platform" -t "$image" $@
fi
