#!/bin/bash
set +e

API_URL="http://localhost:3000/api"

echo "=== 1. Testing Login ==="
LOGIN_RES=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpassword"}')

ACCESS_TOKEN=$(echo $LOGIN_RES | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
REFRESH_TOKEN=$(echo $LOGIN_RES | grep -o '"refreshToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Login failed!"
  echo $LOGIN_RES
  exit 1
fi
echo "Login successful. Received access and refresh tokens."

echo -e "\n=== 2. Testing /auth/me ==="
ME_RES=$(curl -s -X GET $API_URL/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo $ME_RES | grep -q '"username":"admin"' && echo "/auth/me works!" || echo "/auth/me failed!"

echo -e "\n=== 3. Testing Refresh Token ==="
REFRESH_RES=$(curl -s -X POST $API_URL/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
NEW_ACCESS_TOKEN=$(echo $REFRESH_RES | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
NEW_REFRESH_TOKEN=$(echo $REFRESH_RES | grep -o '"refreshToken":"[^"]*' | grep -o '[^"]*$')
if [ -n "$NEW_ACCESS_TOKEN" ] && [ "$NEW_REFRESH_TOKEN" != "$REFRESH_TOKEN" ]; then
  echo "Refresh successful. Received new tokens."
else
  echo "Refresh failed!"
  echo $REFRESH_RES
  exit 1
fi

echo -e "\n=== 4. Testing Token Rotation (Old Token Revoked) ==="
OLD_REFRESH_RES=$(curl -s -X POST $API_URL/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
if echo "$OLD_REFRESH_RES" | grep -iq -e '401' -e 'unauthorized'; then
  echo "Old token correctly rejected."
else
  echo "Token rotation failed!"
  echo "Response: $OLD_REFRESH_RES"
  exit 1
fi

echo -e "\n=== 5. Testing Forgot Password ==="
FORGOT_RES=$(curl -s -X POST $API_URL/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}')

# Wait a moment for DB write
sleep 1
# Get the token directly from the database
RESET_TOKEN=$(cd packages/database && node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.passwordResetToken.findFirst({where:{user:{username:'admin'}},orderBy:{createdAt:'desc'}}).then(t=>{console.log(t?t.token:''); p.\$disconnect()})")

if [ -n "$RESET_TOKEN" ]; then
  echo "Forgot password works. Received reset token."
else
  echo "Forgot password failed!"
  echo "Response: $FORGOT_RES"
  exit 1
fi

echo -e "\n=== 6. Testing Weak Password Validation ==="
WEAK_RES=$(curl -s -X POST $API_URL/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"weak\"}")
if echo "$WEAK_RES" | grep -iq -e '400' -e 'password must have' -e 'contain at least one'; then
  echo "Weak password correctly rejected."
else
  echo "Weak password test failed!"
  echo "Response: $WEAK_RES"
  exit 1
fi

echo -e "\n=== 7. Testing Rate Limiting ==="
# Login is limited to 5 requests per minute. We already did 1. Let's do 5 more.
for i in {1..5}; do
  curl -s -X POST $API_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"WrongPass123!"}' > /dev/null
done
RATE_LIMIT_RES=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"WrongPass123!"}')
if echo "$RATE_LIMIT_RES" | grep -iq -e 'RATE_LIMIT_EXCEEDED' -e 'ACCOUNT_LOCKED'; then
  echo "Security correctly returned 423 / 429 (ACCOUNT_LOCKED or RATE_LIMIT_EXCEEDED)."
else
  echo "Security test failed!"
  echo "Response: $RATE_LIMIT_RES"
  exit 1
fi

echo -e "\n=== 8. Checking Swagger Docs ==="
if curl -s -I $API_URL/docs | grep -q '200 OK'; then
  echo "Swagger UI is running."
else
  echo "Swagger UI failed!"
  exit 1
fi

echo -e "\n=== End of Smoke Tests ==="
