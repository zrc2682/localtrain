#!/bin/bash
set -e

BASE="http://localhost:3008/api"

# 无论成功失败，退出时删除本次创建的测试题目（DELETE 会级联停容器、清记录）
CLEANUP_CHALLENGE_ID=""
ADMIN_TOKEN=""
cleanup() {
  if [ -n "$CLEANUP_CHALLENGE_ID" ] && [ -n "$ADMIN_TOKEN" ]; then
    curl -s -X DELETE "$BASE/challenges/$CLEANUP_CHALLENGE_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
    echo "cleanup: 已删除测试题目 $CLEANUP_CHALLENGE_ID"
  fi
}
trap cleanup EXIT

echo "1. 登录 admin"
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "admin token ok"

echo "2. 创建多 flag 题目"
CHALLENGE=$(curl -s -X POST "$BASE/challenges" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"title":"测试Web题","description":"一个测试题目","category":"web","difficulty":"medium","flags":["flag{first}","flag{second}"],"image":"vulnweb:latest","port":8080}')
CHALLENGE_ID=$(echo "$CHALLENGE" | sed -n 's/.*"id":"\([^"]*\)","title".*/\1/p')
CLEANUP_CHALLENGE_ID="$CHALLENGE_ID"
echo "challenge id: $CHALLENGE_ID"

echo "3. 添加提示"
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/hints" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"level":1,"label":"初级提示","content":"先看看源码","scorePenalty":0}' > /dev/null
echo "hint added"

echo "4. 获取题目列表"
curl -s "$BASE/challenges" -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 200
echo ""

echo "5. 登录普通用户"
USER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"user","password":"user"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "user token ok"

echo "6. 获取题目详情"
curl -s "$BASE/challenges/$CHALLENGE_ID" -H "Authorization: Bearer $USER_TOKEN" | head -c 300
echo ""

echo "7. 启动环境"
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/start" -H "Authorization: Bearer $USER_TOKEN"
echo ""

echo "8. 提交 flag1"
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"index":0,"flag":"flag{first}"}'
echo ""

echo "9. 提交 flag2（完整解出）"
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"index":1,"flag":"flag{second}"}'
echo ""

echo "10. 提交错误 flag"
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"index":0,"flag":"flag{wrong}"}'
echo ""

echo "11. 个人主页"
curl -s "$BASE/users/profile" -H "Authorization: Bearer $USER_TOKEN" | head -c 300
echo ""

echo "12. 重置题目进度"
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/reset" -H "Authorization: Bearer $USER_TOKEN"
echo ""

echo "13. 获取题目详情（已重置）"
DETAIL=$(curl -s "$BASE/challenges/$CHALLENGE_ID" -H "Authorization: Bearer $USER_TOKEN")
echo "$DETAIL" | head -c 300
echo ""
if echo "$DETAIL" | grep -q '"solved":false'; then
  echo "reset ok: challenge is not solved"
else
  echo "reset failed: challenge still solved"
  exit 1
fi

echo "14. 再次完整解出（验证解出次数 +1）"
PROFILE_BEFORE=$(curl -s "$BASE/users/profile" -H "Authorization: Bearer $USER_TOKEN")
SOLVED_BEFORE=$(echo "$PROFILE_BEFORE" | sed -n 's/.*"solvedCount":\([0-9]*\).*/\1/p')
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"index":0,"flag":"flag{first}"}' > /dev/null
curl -s -X POST "$BASE/challenges/$CHALLENGE_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d '{"index":1,"flag":"flag{second}"}' > /dev/null
PROFILE_AFTER=$(curl -s "$BASE/users/profile" -H "Authorization: Bearer $USER_TOKEN")
echo "$PROFILE_AFTER" | head -c 300
echo ""
SOLVED_AFTER=$(echo "$PROFILE_AFTER" | sed -n 's/.*"solvedCount":\([0-9]*\).*/\1/p')
if [ "$((SOLVED_BEFORE + 1))" -eq "$SOLVED_AFTER" ]; then
  echo "solve count increased ok"
else
  echo "solve count mismatch: before=$SOLVED_BEFORE after=$SOLVED_AFTER"
  exit 1
fi

echo "All tests passed"
