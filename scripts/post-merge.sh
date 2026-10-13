#!/bin/bash
set -e
npm ci --legacy-peer-deps
npm run db:push
