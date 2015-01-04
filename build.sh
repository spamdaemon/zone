#!/bin/sh

CLOSURE_PATH=../closure
COMPILER_JAR=${CLOSURE_PATH}/compiler.jar

PWD=`pwd`;
PROJECT_NAME=`basename $PWD`;
MODULES_NAME=${PROJECT_NAME}.modules;

MODULE_SOURCES=`find src/modules -name \*.js`
SOURCES="src/main.js ${SOURCES}"

# compile to minify
rm -f  ${PROJECT_NAME}.min.js ${PROJECT_NAME}.min.js.gz ${MODULES_NAME}.min.js ${MODULES_NAME}.min.js.gz
if [ -e $COMPILER_JAR ]; then
    java -jar ${COMPILER_JAR} -W VERBOSE --language_in ECMASCRIPT5_STRICT --compilation_level ADVANCED_OPTIMIZATIONS --js_output_file ${PROJECT_NAME}.min.js ${SOURCES};
    java -jar ${COMPILER_JAR} --externs externs.js -W VERBOSE --language_in ECMASCRIPT5_STRICT --compilation_level ADVANCED_OPTIMIZATIONS --js_output_file ${MODULES_NAME}.min.js ${MODULE_SOURCES};
    gzip --best --keep ${PROJECT_NAME}.min.js;
    gzip --best --keep ${MODULES_NAME}.min.js;
fi;
cp src/main.js zone.js;


# run tests
karma start --single-run --log-level debug
