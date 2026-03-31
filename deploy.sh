#!/bin/bash
# Deploy to production and update nexusad.ai alias

echo "🚀 Deploying to Vercel..."
OUTPUT=$(npx vercel --prod --json)

if [ $? -eq 0 ]; then
    URL=$(echo $OUTPUT | jq -r '.deployment.url')
    echo "✅ Deployed to: $URL"

    echo "🔗 Updating nexusad.ai alias..."
    npx vercel alias set $URL nexusad.ai

    echo "✨ Done! nexusad.ai now points to the latest deployment."
else
    echo "❌ Deployment failed"
    exit 1
fi