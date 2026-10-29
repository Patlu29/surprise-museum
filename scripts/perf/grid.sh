#!/bin/bash
# usage: grid.sh <port> <outfile>
PORT=$1; OUT=$2
run() { node "$(dirname "$0")/frames.mjs" --port $PORT --live --seconds 60 --out $OUT "$@" > /dev/null 2>&1 || echo "FAILED: $@" >> $OUT.err; }
for gpu in m4 sw; do
  for prof in phone laptop; do
    for q in low high; do
      for cpu in 4 6; do
        run --museum 20 --gpu $gpu --profile $prof --quality $q --cpu $cpu
      done
    done
  done
done
# extra: headroom and 5-photo reference on M4
run --museum 20 --gpu m4 --profile phone --quality low --cpu 12
run --museum 20 --gpu m4 --profile phone --quality low --cpu 20
run --museum 20 --gpu m4 --profile laptop --quality high --cpu 1
run --museum 5 --gpu m4 --profile phone --quality low --cpu 4
run --museum 5 --gpu m4 --profile laptop --quality high --cpu 4
echo done >> $OUT.done
