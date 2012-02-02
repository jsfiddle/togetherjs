#!/bin/sh

cd "$( dirname "${BASH_SOURCE[0]}" )" 
cd ..
APP_ROOT=`pwd`
BOOTSTRAP=$1
export PATH=$PATH:$APP_ROOT/node_modules/.bin

ACTIVE_LESSC=`which lessc`


if [ -f `which lessc` ]; then
  if [ $ACTIVE_LESSC != "$APP_ROOT/node_modules/.bin/lessc" ]; then
    echo "WARNING: lessc is not the version installed by npm in towtruck."
    echo "         Found less in $ACTIVE_LESSC"
    echo
    read -p "Press [Enter] key to continue..."

  fi

  if [ `head -c 9 $BOOTSTRAP/Makefile` == "BOOTSTRAP" ]; then
    cd $BOOTSTRAP
    rm -rf bootstrap
    make bootstrap
    rm -rf $APP_ROOT/http/public/bootstrap
    mv bootstrap $APP_ROOT/http/public/bootstrap
  else
    echo "ERROR: Bootstrap not found at $BOOTSTRAP"
    echo 
    echo -e "Usage: \n\t$0 <path to bootstrap checkout>"
    echo -e "\t(See https://github.com/twitter/bootstrap/ for details)"
  fi
else
  echo "lessc doesn't seem to be installed. Run npm install in $APP_ROOT"
fi
