#!/bin/bash
# usage: loadgrid.sh <port> <outfile>
PORT=$1; OUT=$2
for cfg in "phone 1 20" "phone 4 20" "phone 6 20" "phone 6 5" "laptop 4 20" "laptop 1 20"; do
  set -- $cfg
  node "$(dirname "$0")/load.mjs" --port $PORT --museum $3 --profile $1 --cpu $2 --net 4g --gpu m4 --live --runs 3 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(json.dumps({'cfg':'$1 cpu$2 m$3','median':d['median'],'runs':d['runs'],'logs':d['logs']}))" >> $OUT
done
# worst case: software GL at 6x
node "$(dirname "$0")/load.mjs" --port $PORT --museum 20 --profile phone --cpu 6 --net 4g --gpu sw --live --runs 3 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(json.dumps({'cfg':'phone cpu6 m20 swiftshader','median':d['median'],'runs':d['runs'],'logs':d['logs']}))" >> $OUT
echo done > $OUT.done
