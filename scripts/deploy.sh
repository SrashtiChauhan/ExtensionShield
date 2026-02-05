#!/bin/bash
# ExtensionShield - Railway Deployment Script
# Quick shortcut to trigger auto deployment from CLI

set -e

echo "🚀 Deploying ExtensionShield to Railway..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "⚠️  Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if project is linked
if ! railway status &> /dev/null; then
    echo "⚠️  Project not linked. Please link your Railway project first:"
    echo "   railway login"
    echo "   railway link"
    exit 1
fi

# Deploy
echo "📦 Starting deployment..."
railway up --detach

echo ""
echo "✅ Deployment triggered successfully!"
echo ""
echo "View deployment status:"
echo "  railway status"
echo ""
echo "View logs:"
echo "  railway logs -f"
echo ""

