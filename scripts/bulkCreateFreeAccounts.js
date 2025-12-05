// Bulk create free Keap accounts for existing test users
// This prevents them from losing their conversation history
import 'dotenv/config';
import { createOrUpdateContact, findContactByEmail } from '../utils/keapIntegration.js';

/**
 * List of users to create free accounts for
 * Add emails, first names, and last names here
 */
const usersToCreate = [
  // Example:
  // { email: 'user@example.com', firstName: 'John', lastName: 'Doe' },

  // Add users here:

];

async function bulkCreateFreeAccounts() {
  console.log('🚀 Starting bulk free account creation...');
  console.log(`📊 Processing ${usersToCreate.length} users\n`);

  const results = {
    created: [],
    skipped: [],
    errors: []
  };

  for (const user of usersToCreate) {
    const { email, firstName, lastName } = user;

    try {
      console.log(`\n📧 Processing: ${email}`);

      // Check if contact already exists in Keap
      const existingContact = await findContactByEmail(email);

      if (existingContact) {
        console.log(`⏭️  SKIPPED - ${email} already exists in Keap (Contact ID: ${existingContact.id})`);
        results.skipped.push({ email, contactId: existingContact.id, reason: 'Already exists' });
        continue;
      }

      // Create contact in Keap without subscription tags (free tier)
      const contact = await createOrUpdateContact({
        email,
        given_name: firstName,
        family_name: lastName
      });

      if (contact && contact.id) {
        console.log(`✅ CREATED - ${email} (Contact ID: ${contact.id})`);
        results.created.push({ email, contactId: contact.id, firstName, lastName });
      } else {
        throw new Error('Contact creation returned no ID');
      }

    } catch (error) {
      console.error(`❌ ERROR - Failed to create ${email}:`, error.message);
      results.errors.push({ email, error: error.message });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${results.created.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);

  if (results.created.length > 0) {
    console.log('\n✅ Successfully Created:');
    results.created.forEach(u => {
      console.log(`   - ${u.email} (${u.firstName} ${u.lastName}) - Contact ID: ${u.contactId}`);
    });
  }

  if (results.skipped.length > 0) {
    console.log('\n⏭️  Skipped (Already Exist):');
    results.skipped.forEach(u => {
      console.log(`   - ${u.email} - Contact ID: ${u.contactId}`);
    });
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(u => {
      console.log(`   - ${u.email}: ${u.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📅 All created users will have free access until January 15, 2026');
  console.log('💾 Their conversation history will be preserved');
  console.log('='.repeat(60));
}

// Run the script
bulkCreateFreeAccounts().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
