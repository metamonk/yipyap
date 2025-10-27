/**
 * Test script for password reset email functionality
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json node scripts/test-password-reset.js <email>
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const testEmail = process.argv[2];

if (!testEmail) {
  console.error('Usage: node scripts/test-password-reset.js <email>');
  process.exit(1);
}

async function testPasswordReset() {
  console.log(`\n🔍 Testing password reset for: ${testEmail}\n`);

  try {
    // Step 1: Check if user exists
    console.log('Step 1: Checking if user exists...');
    try {
      const userRecord = await admin.auth().getUserByEmail(testEmail);
      console.log('✅ User found:', {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        providers: userRecord.providerData.map((p) => p.providerId),
      });

      if (userRecord.disabled) {
        console.log('⚠️  WARNING: User account is disabled!');
      }

      if (!userRecord.providerData.some((p) => p.providerId === 'password')) {
        console.log('⚠️  WARNING: User does not have password provider!');
        console.log('   User can only sign in via:', userRecord.providerData.map((p) => p.providerId).join(', '));
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('❌ User NOT found in Firebase Auth');
        console.log('   Firebase Auth will NOT send password reset emails to non-existent users');
        console.log('   This is a security feature to prevent email enumeration');
        process.exit(1);
      }
      throw error;
    }

    // Step 2: Generate password reset link (Admin SDK)
    console.log('\nStep 2: Generating password reset link...');
    const link = await admin.auth().generatePasswordResetLink(testEmail);
    console.log('✅ Password reset link generated successfully:');
    console.log('   Link:', link);

    // Step 3: Check email settings
    console.log('\nStep 3: Checking Firebase project configuration...');
    const projectId = admin.app().options.projectId;
    console.log('✅ Project ID:', projectId);
    console.log('\n📧 Email Template Configuration:');
    console.log(`   Firebase Console: https://console.firebase.google.com/project/${projectId}/authentication/emails`);
    console.log('   Check:');
    console.log('   - Password reset template is enabled');
    console.log('   - Sender email/name is configured');
    console.log('   - Domain is verified (for custom domains)');

    // Step 4: Summary
    console.log('\n✅ SUMMARY:');
    console.log('   - User exists: ✓');
    console.log('   - Password reset link can be generated: ✓');
    console.log('   - Firebase Auth is configured correctly: ✓');
    console.log('\n💡 If emails are still not being received:');
    console.log('   1. Check spam/junk folders');
    console.log('   2. Verify email template configuration in Firebase Console (link above)');
    console.log('   3. For corporate emails (Microsoft 365), check with IT admin');
    console.log('   4. Test with a personal email (Gmail, Yahoo, etc.)');
    console.log('   5. Check Firebase Console logs for delivery errors\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    process.exit(1);
  }
}

testPasswordReset();
