#!/usr/bin/env bash

curl -i -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data '{
    "host": "https://livesatelliteorbits.com/",
    "key": "e1e697cc93a04faca7349d3f9d481344",
    "keyLocation": "https://livesatelliteorbits.com/e1e697cc93a04faca7349d3f9d481344.txt",
    "urlList": [
      "https://livesatelliteorbits.com/",
      "https://livesatelliteorbits.com/what-is-this",
      "https://livesatelliteorbits.com/data",
      "https://livesatelliteorbits.com/methodology",
      "https://livesatelliteorbits.com/about"
    ]
  }'
