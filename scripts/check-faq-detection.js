const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'yipyap-444' });
const db = admin.firestore();

async function checkFAQDetection() {
  console.log('Checking last 20 messages for FAQ detection metadata:\n');

  const snapshot = await db.collectionGroup('messages')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  let withMetadata = 0;
  let withSuggestedFAQ = 0;
  let withAutoResponse = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const metadata = data.metadata || {};

    if (metadata.faqMatchConfidence !== undefined) {
      withMetadata++;
      console.log('---');
      console.log('Message:', data.text?.substring(0, 50));
      console.log('Confidence:', metadata.faqMatchConfidence);
      console.log('isFAQ:', metadata.isFAQ);
      console.log('suggestedFAQ:', metadata.suggestedFAQ ? 'YES' : 'NO');
      console.log('autoResponseSent:', metadata.autoResponseSent ? 'YES' : 'NO');

      if (metadata.suggestedFAQ) withSuggestedFAQ++;
      if (metadata.autoResponseSent) withAutoResponse++;
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log('  Messages with FAQ detection:', withMetadata);
  console.log('  Messages with suggested FAQ:', withSuggestedFAQ);
  console.log('  Messages with auto-response:', withAutoResponse);
  console.log('  Messages without FAQ metadata:', 20 - withMetadata);

  process.exit(0);
}

checkFAQDetection().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
