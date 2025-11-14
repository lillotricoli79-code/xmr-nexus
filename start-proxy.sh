#!/usr/bin/env bash
echo "Avvio proxy XMR Nexus con dev fee 10%"
chmod +x ./app.js
node app.js --config proxy.config.json
