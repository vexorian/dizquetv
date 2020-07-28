#!/bin/sh
WIN64=pseudotv-win-x64.exe
WIN32=pseudotv-win-x86.exe
MACOSX=pseudotv-macos-x64
LINUX64=pseudotv-linux-x64

npm run build
npm run compile
cp -R ./web ./dist/web
cp -R ./resources ./dist/
cd dist
nexe -r "./**/*" -t windows-x64-12.18.2 --output $WIN64
nexe -r "./**/*" -t linux-x64-12.16.2  --output $LINUX64
nexe -r "./**/*" -t mac-x64-12.18.2 --output $MACOSX
nexe -r "./**/*" -t windows-x86-12.18.2 --output $WIN32

echo dist/$WIN64
echo dist/$LINUX64
echo dist/$MACOSX
echo dist/WIN32
