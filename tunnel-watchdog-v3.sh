#!/bin/bash
# V3隧道守护脚本 - 自动重连 + 健康检查
# 使用 localhost.run 隧道

PORT=8789
LOG="/tmp/tunnel-v3-watchdog.log"
PID_FILE="/tmp/tunnel-v3.pid"
URL_FILE="/tmp/tunnel-v3-url.txt"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

while true; do
  # 检查本地服务是否在线
  if ! curl -s --max-time 3 "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
    log "Local service on :${PORT} not responding, waiting..."
    sleep 10
    continue
  fi

  # 检查隧道进程是否存活
  TUNNEL_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    # 进程在，检查隧道URL是否可达
    TUNNEL_URL=$(cat "$URL_FILE" 2>/dev/null)
    if [ -n "$TUNNEL_URL" ] && curl -s --max-time 10 "${TUNNEL_URL}/api/health" > /dev/null 2>&1; then
      log "Tunnel healthy: ${TUNNEL_URL}"
      sleep 60
      continue
    fi
  fi

  # 隧道挂了，重建
  log "Rebuilding tunnel..."
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
  sleep 2

  ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R 80:localhost:${PORT} localhost.run > /tmp/tunnel-v3-connect.log 2>&1 &
  NEW_PID=$!
  echo "$NEW_PID" > "$PID_FILE"
  log "New tunnel PID: ${NEW_PID}"

  # 等待URL出现
  sleep 10
  NEW_URL=$(grep -oP 'https://[a-z0-9.-]+\.lhr\.life' /tmp/tunnel-v3-connect.log 2>/dev/null | head -1)
  if [ -n "$NEW_URL" ]; then
    echo "$NEW_URL" > "$URL_FILE"
    log "New tunnel URL: ${NEW_URL}"
    # 验证可达
    if curl -s --max-time 10 "${NEW_URL}/api/health" > /dev/null 2>&1; then
      log "Tunnel verified and healthy!"
    else
      log "WARNING: Tunnel URL obtained but not reachable yet"
    fi
  else
    log "WARNING: Could not extract tunnel URL, will retry"
  fi

  sleep 30
done
