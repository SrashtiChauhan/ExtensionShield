# WatsonX Setup Guide - What's Implemented vs What's Missing

This guide documents the current WatsonX implementation status and what you need to complete the setup.

---

## 📊 Current Implementation Status

### ✅ What's Already Implemented

1. **Code Implementation** - Fully functional
   - ✅ WatsonX client integration in `src/extension_shield/llm/clients/__init__.py`
   - ✅ Fallback chain support (WatsonX can be used in fallback chain)
   - ✅ LangChain IBM integration (`langchain_ibm` package)
   - ✅ Error handling and retry logic
   - ✅ Test script: `scripts/test_watson_connection.py`

2. **Configuration Support**
   - ✅ Environment variable parsing for:
     - `WATSONX_API_KEY`
     - `WATSONX_PROJECT_ID`
     - `WATSONX_API_ENDPOINT`
   - ✅ Model parameter configuration
   - ✅ Default model: `meta-llama/llama-3-3-70b-instruct`

3. **Documentation**
   - ✅ Basic configuration in `docs/LLM_CONFIGURATION.md`
   - ✅ Environment template in `env.production.template`
   - ✅ Test script with helpful error messages

---

## ❌ What's Missing / What You Need to Do

### 1. IBM Cloud Account Setup

**Status**: ❌ **YOU NEED TO DO THIS**

WatsonX requires an IBM Cloud account with specific services configured. Unlike OpenAI (which just needs an API key), WatsonX has multiple prerequisites.

#### Step-by-Step Setup:

1. **Create IBM Cloud Account** (if you don't have one)
   - Go to: https://cloud.ibm.com
   - Sign up for free account (Lite plan is free)

2. **Create API Key**
   - Go to: https://cloud.ibm.com/iam/apikeys
   - Click "Create an IBM Cloud API key"
   - Name it (e.g., "ExtensionShield WatsonX")
   - Copy the API key immediately (you can't see it again)
   - **Set in `.env`**: `WATSONX_API_KEY=your-api-key-here`

3. **Create Watson Machine Learning (WML) Service Instance**
   - Go to: https://cloud.ibm.com/catalog
   - Search for "Watson Machine Learning"
   - Click on it
   - Select **Lite plan** (free tier)
   - Choose your region (e.g., US South, EU, UK)
   - Create the service instance
   - **Wait for it to become "Active"** (can take 2-5 minutes)

4. **Create WatsonX Project**
   - Go to: https://dataplatform.cloud.ibm.com
   - Click "New project" or "Create project"
   - Name your project (e.g., "ExtensionShield")
   - **IMPORTANT**: Associate it with the WML instance you created
     - In project settings → Services → Add service
     - Select your Watson Machine Learning instance
   - Copy the **Project ID** from the project overview
   - **Set in `.env`**: `WATSONX_PROJECT_ID=your-project-id-here`

5. **Get API Endpoint**
   - Based on your region, use the appropriate endpoint:
     - **US South**: `https://us-south.ml.cloud.ibm.com`
     - **EU (Frankfurt)**: `https://eu-de.ml.cloud.ibm.com`
     - **UK (London)**: `https://eu-gb.ml.cloud.ibm.com`
     - **US East**: `https://us-east.ml.cloud.ibm.com`
   - **Set in `.env`**: `WATSONX_API_ENDPOINT=https://us-south.ml.cloud.ibm.com`

6. **Verify Model Availability**
   - In your WatsonX project, check available models
   - Default model: `meta-llama/llama-3-3-70b-instruct`
   - If not available, you may need to:
     - Request access to the model
     - Or use a different model available in your project
   - **Set in `.env`**: `LLM_MODEL=meta-llama/llama-3-3-70b-instruct`

---

## 🔍 Comparison: OpenAI vs WatsonX

### OpenAI Setup (Simple - 2 Steps)

1. ✅ Get API key from https://platform.openai.com/api-keys
2. ✅ Set `OPENAI_API_KEY=sk-...` in `.env`
3. ✅ Done! (That's it)

**Time**: ~2 minutes

### WatsonX Setup (Complex - 6 Steps)

1. ❌ Create IBM Cloud account
2. ❌ Create API key
3. ❌ Create Watson Machine Learning service instance
4. ❌ Create WatsonX project
5. ❌ Associate WML instance with project
6. ❌ Configure environment variables

**Time**: ~15-20 minutes (including wait times)

**Why it's more complex:**
- Requires multiple IBM Cloud services
- Needs service instance association
- Project-based (not just API key)
- Region-specific endpoints
- Model access may need approval

---

## 🛠️ Configuration Checklist

Use this checklist to verify your WatsonX setup:

### Environment Variables

- [ ] `WATSONX_API_KEY` - Your IBM Cloud API key
- [ ] `WATSONX_PROJECT_ID` - Your WatsonX project ID
- [ ] `WATSONX_API_ENDPOINT` - API endpoint matching your region
- [ ] `LLM_PROVIDER=watsonx` (or include in `LLM_FALLBACK_CHAIN`)
- [ ] `LLM_MODEL` - Model name available in your project

### IBM Cloud Setup

- [ ] IBM Cloud account created
- [ ] API key created and copied
- [ ] Watson Machine Learning service instance created
- [ ] WML instance is in "Active" status
- [ ] WatsonX project created
- [ ] WML instance associated with WatsonX project
- [ ] Model access verified in project

### Testing

- [ ] Run test script: `python scripts/test_watson_connection.py`
- [ ] Verify connection succeeds
- [ ] Test with actual ExtensionShield scan

---

## 🧪 Testing Your Setup

### Quick Test

Run the test script to verify everything is configured correctly:

```bash
python scripts/test_watson_connection.py
```

This will:
1. ✅ Check all environment variables are set
2. ✅ Test WatsonX client initialization
3. ✅ Make a test API call
4. ✅ Provide helpful error messages if something fails

### Common Errors and Fixes

#### Error: "401 Unauthorized"
- **Cause**: Invalid API key or API key doesn't have WatsonX access
- **Fix**: 
  - Verify API key at https://cloud.ibm.com/iam/apikeys
  - Ensure API key has WatsonX permissions

#### Error: "404 Not Found" or "Invalid Project ID"
- **Cause**: Project ID doesn't exist or you don't have access
- **Fix**: 
  - Verify project ID at https://dataplatform.cloud.ibm.com
  - Check you're using the correct project ID

#### Error: "WML Instance Inactive" or "Invalid Instance Status"
- **Cause**: Watson Machine Learning instance is not active
- **Fix**:
  1. Go to https://cloud.ibm.com
  2. Find your Watson Machine Learning service
  3. Ensure it's in "Active" status
  4. Wait a few minutes if it was just created

#### Error: "No Associated Service Instance"
- **Cause**: WatsonX project is not associated with a WML instance
- **Fix**:
  1. Go to https://dataplatform.cloud.ibm.com
  2. Open your WatsonX project
  3. Go to Settings → Services
  4. Add your Watson Machine Learning instance
  5. Wait a few minutes for association to complete

#### Error: "Model Not Found"
- **Cause**: Model not available in your project
- **Fix**:
  - Check available models in your WatsonX project
  - Update `LLM_MODEL` to an available model
  - Request model access if needed

#### Error: "Invalid Endpoint" or "Connection Refused"
- **Cause**: Wrong endpoint URL or region mismatch
- **Fix**:
  - Verify endpoint matches your WML instance region
  - Common endpoints:
    - US South: `https://us-south.ml.cloud.ibm.com`
    - EU: `https://eu-de.ml.cloud.ibm.com`
    - UK: `https://eu-gb.ml.cloud.ibm.com`

---

## 📝 Complete `.env` Configuration Example

```bash
# WatsonX Configuration
LLM_PROVIDER=watsonx
WATSONX_API_KEY=your-ibm-cloud-api-key-here
WATSONX_PROJECT_ID=your-project-id-here
WATSONX_API_ENDPOINT=https://us-south.ml.cloud.ibm.com
LLM_MODEL=meta-llama/llama-3-3-70b-instruct

# OR use in fallback chain (recommended: watsonx first, then openai)
LLM_FALLBACK_CHAIN=watsonx,openai
# ... (still need all WatsonX variables above)
```

---

## 🔄 Using WatsonX in Fallback Chain

WatsonX is the default primary provider, with OpenAI as fallback:

```bash
LLM_FALLBACK_CHAIN=watsonx,openai
LLM_MODEL=meta-llama/llama-3-3-70b-instruct  # For WatsonX
# WatsonX config (primary)
WATSONX_API_KEY=your-key
WATSONX_PROJECT_ID=your-project-id
WATSONX_API_ENDPOINT=https://us-south.ml.cloud.ibm.com
# OpenAI config (fallback)
OPENAI_API_KEY=sk-...
```

The system will:
1. Try WatsonX first (default)
2. Fallback to OpenAI if WatsonX fails
3. Fallback to WatsonX if OpenAI fails

---

## 📚 Additional Resources

- **IBM Cloud Console**: https://cloud.ibm.com
- **WatsonX Platform**: https://dataplatform.cloud.ibm.com
- **API Keys Management**: https://cloud.ibm.com/iam/apikeys
- **Watson Machine Learning**: https://cloud.ibm.com/catalog/services/watson-machine-learning
- **WatsonX Documentation**: https://www.ibm.com/products/watsonx-ai
- **LangChain IBM Integration**: https://python.langchain.com/docs/integrations/chat/watsonx

---

## ✅ Summary

### What You Have (Code)
- ✅ Full WatsonX integration
- ✅ Fallback chain support
- ✅ Error handling
- ✅ Test script

### What You Need (Setup)
- ❌ IBM Cloud account
- ❌ API key
- ❌ Watson Machine Learning service instance
- ❌ WatsonX project
- ❌ Service association
- ❌ Environment variables configured

### Time Estimate
- **Code setup**: Already done ✅
- **IBM Cloud setup**: ~15-20 minutes
- **Testing**: ~5 minutes

**Total**: ~20-25 minutes to get WatsonX fully working

---

## 🚀 Quick Start Commands

1. **Test current configuration**:
   ```bash
   python scripts/test_watson_connection.py
   ```

2. **If test fails, follow the error messages** - they're designed to guide you to the fix

3. **Once test passes, WatsonX is ready to use!**

---

**Last Updated**: 2025-01-30

