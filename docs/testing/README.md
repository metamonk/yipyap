# User Testing Documentation

This folder contains guides for manually testing yipyap features with real devices and user accounts.

## Available Testing Guides

### 📱 [Offline Functionality Testing](./offline-functionality-testing.md)

**Purpose:** Test offline messaging, sync, and reconnection features

**What's Tested:**

- Message queuing while offline
- Auto-sync when reconnected
- Persistent chat history after force-quit
- Connection status UI indicators
- Network drop recovery (30s+ outages)
- Sub-1 second sync performance

**Requirements:**

- 2 physical devices with different accounts
- Ability to control network (WiFi/Airplane Mode)

**Duration:** ~20-30 minutes for full test suite

---

### 🤖 [Daily Agent Auto-Response Testing](./daily-agent-testing.md)

**Purpose:** Test AI-powered automatic FAQ detection and response

**What's Tested:**

- Daily Agent workflow execution
- FAQ template matching with embeddings
- Auto-response generation and sending
- Approval workflow (manual vs. auto)
- Digest summary creation
- Edge Function integration

**Requirements:**

- 2 devices (one creator, one sender)
- FAQ templates configured with embeddings
- Pinecone API access
- Firebase Cloud Functions deployed

**Duration:** ~15-20 minutes (manual trigger) or 1+ hour (scheduled trigger)

---

## Testing Best Practices

### Before You Start

1. **Check environment variables** - Ensure all API keys are configured
2. **Verify Firebase deployment** - Functions and Edge Functions must be deployed
3. **Test with Firebase Emulator** first (when applicable) for faster iteration
4. **Use separate test accounts** - Don't test with production user data
5. **Document issues immediately** - Take screenshots and note console logs

### During Testing

- **Follow the guide step-by-step** - Don't skip steps
- **Verify expected results** at each checkpoint
- **Check Firebase console** for backend execution logs
- **Monitor network requests** in DevTools (when applicable)
- **Note performance metrics** (sync times, load times, etc.)

### After Testing

- **Report bugs** with full reproduction steps
- **Update test docs** if procedures changed
- **Share results** with the team
- **Clean up test data** if needed

---

## Troubleshooting Resources

### Common Issues Across Tests

**Symptoms:** Features not working as expected

**General Debug Steps:**

1. Check **Firebase console** for errors
2. Review **Firestore security rules** for permission issues
3. Verify **environment variables** are set correctly
4. Check **console logs** for JavaScript errors
5. Ensure **app is up to date** with latest code
6. Try **clearing app cache/data** and restarting

### Getting Help

If you encounter issues during testing:

1. **Check the troubleshooting section** in the specific test guide
2. **Search related docs** in `docs/architecture/` for technical details
3. **Review Firebase logs** for backend errors
4. **Create a GitHub issue** with:
   - Test guide being followed
   - Step where issue occurred
   - Expected vs. actual behavior
   - Console logs and screenshots
   - Device info (OS, version, etc.)

---

## Related Documentation

- [Architecture Documentation](../architecture/index.md) - Technical implementation details
- [Setup Guides](../setup/) - Environment and infrastructure setup
- [QA Gates](../qa/gates/) - Automated test gates and acceptance criteria
- [Feature Documentation](../features/) - Feature-specific guides and workflows

---

## Contributing to Test Docs

When adding new testing guides:

1. **Use clear structure** - Follow the format of existing guides
2. **Include prerequisites** - List requirements upfront
3. **Provide step-by-step instructions** - Be explicit, assume no prior knowledge
4. **Document expected results** - What should happen at each step
5. **Add troubleshooting section** - Common issues and solutions
6. **Link to related code** - Reference implementation files
7. **Update this README** - Add your guide to the list above

### Test Doc Template

```markdown
# [Feature Name] Testing Guide

## Overview

Brief description of what's being tested

## Features Covered

List of features/capabilities tested

## Test Setup Requirements

- Prerequisites
- Tools needed
- Account/data requirements

## Test 1: [Test Name]

**Objective:** What this test validates

### Steps

1. Action 1
2. Action 2
   ...

### Expected Results

- ✅ Result 1
- ✅ Result 2

## Troubleshooting

Common issues and solutions

## Success Criteria

What defines a passing test
```

---

Last Updated: 2025-10-24
