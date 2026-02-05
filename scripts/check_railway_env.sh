#!/bin/bash
# Quick helper script to check Railway environment variables
# Compatible with bash 3.2+ (macOS default)

echo "🔍 ExtensionShield - Railway Environment Variables Check"
echo "========================================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if project is linked
if ! railway status &> /dev/null 2>&1; then
    echo "❌ Not linked to a Railway project. Run:"
    echo "   railway login"
    echo "   railway link"
    exit 1
fi

echo "✅ Railway CLI is installed and project is linked"
echo ""
echo "📋 Checking environment variables..."
echo ""

# Get all Railway variables
VARS=$(railway variables 2>/dev/null)

# Function to check if a variable exists
check_var() {
    local var_name="$1"
    local description="$2"
    
    if echo "$VARS" | grep -q "^$var_name="; then
        echo "✅ $var_name"
        echo "   $description"
        return 0
    else
        echo "❌ $var_name (MISSING)"
        echo "   $description"
        return 1
    fi
}

# Function to check optional variable
check_optional_var() {
    local var_name="$1"
    local description="$2"
    
    if echo "$VARS" | grep -q "^$var_name="; then
        echo "✅ $var_name"
    else
        echo "⚪ $var_name (not set)"
    fi
    echo "   $description"
}

# Check required variables
echo "REQUIRED VARIABLES:"
echo "==================="
MISSING_COUNT=0

check_var "VITE_SUPABASE_URL" "Frontend build-time: Supabase project URL" || ((MISSING_COUNT++))
echo ""
check_var "VITE_SUPABASE_ANON_KEY" "Frontend build-time: Supabase anon key" || ((MISSING_COUNT++))
echo ""
check_var "SUPABASE_URL" "Backend runtime: Supabase project URL" || ((MISSING_COUNT++))
echo ""
check_var "SUPABASE_SERVICE_ROLE_KEY" "Backend runtime: Supabase service role key" || ((MISSING_COUNT++))
echo ""
check_var "LLM_PROVIDER" "Backend runtime: LLM provider (openai, watsonx, ollama)" || ((MISSING_COUNT++))
echo ""
check_var "OPENAI_API_KEY" "Backend runtime: OpenAI API key (if using OpenAI)" || ((MISSING_COUNT++))
echo ""

# Check optional variables
echo "OPTIONAL VARIABLES:"
echo "==================="

check_optional_var "LLM_MODEL" "LLM model name (default: gpt-4o)"
echo ""
check_optional_var "VIRUSTOTAL_API_KEY" "VirusTotal API key for malware checks"
echo ""
check_optional_var "VITE_API_BASE_URL" "Custom API base URL for frontend"
echo ""
check_optional_var "CORS_ORIGINS" "Comma-separated CORS origins"
echo ""

# Summary
echo "========================================================="
if [ $MISSING_COUNT -eq 0 ]; then
    echo "✅ All required environment variables are set!"
    echo ""
    echo "You can deploy with:"
    echo "  railway up"
    echo "  OR ./scripts/deploy.sh"
    echo "  OR make deploy"
else
    echo "❌ $MISSING_COUNT required variable(s) missing!"
    echo ""
    echo "To set a variable, use:"
    echo "  railway variables set KEY=VALUE"
    echo ""
    echo "Example:"
    echo "  railway variables set VITE_SUPABASE_URL=https://xxxxx.supabase.co"
    echo ""
    echo "See docs/RAILWAY_DEPLOYMENT.md for detailed setup instructions."
fi
echo ""
