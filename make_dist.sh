#!/bin/sh
MODE=${1:-all}
WIN64=dizquetv-win-x64.exe
WIN32=dizquetv-win-x86.exe
MACOSX=dizquetv-macos-x64
LINUX64=${LINUXBUILD:-dizquetv-linux-x64}

rm -R ./dist/*
npm run build || exit 1
npm run compile  || exit 1
cp -R ./web ./dist/web
cp -R ./resources ./dist/
cd dist
if [ "$MODE" == "all" ]; then
    nexe --temp /var/nexe -r "./**/*" -t windows-x64-12.18.2 --output $WIN64
    mv $WIN64 ../
    nexe --temp /var/nexe -r "./**/*" -t mac-x64-12.18.2 --output $MACOSX
    mv $MACOSX ../
    nexe --temp /var/nexe -r "./**/*" -t windows-x86-12.18.2 --output $WIN32
    mv $WIN32 ../
fi

nexe --temp /var/nexe -r "./**/*" -t linux-x64-12.16.2 --output $LINUX64 || exit 1
echo dist/$LINUX64
if [ "$MODE" == "all" ]; then
    mv ../$WIN64 ./
    mv ../$WIN32 ./
    mv ../$MACOSX ./
    echo dist/$WIN64
    echo dist/$MACOSX
    echo dist/$WIN32
fi

