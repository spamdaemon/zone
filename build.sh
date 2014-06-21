#!/bin/sh

CLOSURE_PATH=../closure
COMPILER_JAR=${CLOSURE_PATH}/compiler.jar

PWD=`pwd`;
PROJECT_NAME=`basename $PWD`;

SOURCES=`find src -name \*.js`

# run tests
karma start --single-run --log-level debug


# compile to minify
rm -f  ${PROJECT_NAME}-min.js ${PROJECT_NAME}-min.js.gz
if [ -e $COMPILER_JAR ]; then
    java -jar ${COMPILER_JAR} --js_output_file ${PROJECT_NAME}-min.js ${SOURCES};
    gzip --best --keep ${PROJECT_NAME}-min.js;
fi;

