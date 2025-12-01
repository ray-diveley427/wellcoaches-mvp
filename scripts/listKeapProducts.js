// =====================================================================
// List Keap Products and Subscriptions
// =====================================================================
// Check what subscription products exist in Keap

import fetch from 'node-fetch';

const KEAP_API_BASE = 'https://api.infusionsoft.com/crm/rest/v1';
const PERSONAL_ACCESS_TOKEN = process.env.KEAP_PERSONAL_ACCESS_TOKEN;

async function keapRequest(endpoint) {
  const response = await fetch(`${KEAP_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Keap API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function listKeapProducts() {
  console.log('\n📦 Checking Keap for Products and Subscriptions...\n');

  try {
    // 1. List products
    console.log('1️⃣ Products:');
    try {
      const products = await keapRequest('/products?limit=100');
      if (products.products && products.products.length > 0) {
        products.products.forEach(product => {
          console.log(`   - ${product.product_name} (ID: ${product.id})`);
          if (product.product_price) {
            console.log(`     Price: $${product.product_price}`);
          }
          if (product.subscription_plan_id) {
            console.log(`     Subscription Plan ID: ${product.subscription_plan_id}`);
          }
        });
      } else {
        console.log('   No products found');
      }
    } catch (err) {
      console.log('   ⚠️ Could not fetch products:', err.message);
    }

    // 2. List subscription plans
    console.log('\n2️⃣ Subscription Plans:');
    try {
      const subscriptions = await keapRequest('/subscriptions/models?limit=100');
      if (subscriptions.subscription_plans && subscriptions.subscription_plans.length > 0) {
        subscriptions.subscription_plans.forEach(plan => {
          console.log(`   - ${plan.subscription_plan_name || 'Unnamed'} (ID: ${plan.id})`);
          if (plan.billing_amount) {
            console.log(`     Amount: $${plan.billing_amount} per ${plan.billing_frequency}`);
          }
        });
      } else {
        console.log('   No subscription plans found');
      }
    } catch (err) {
      console.log('   ⚠️ Could not fetch subscription plans:', err.message);
    }

    // 3. List tags
    console.log('\n3️⃣ Tags (first 50):');
    try {
      const tags = await keapRequest('/tags?limit=50');
      if (tags.tags && tags.tags.length > 0) {
        tags.tags.forEach(tag => {
          console.log(`   - ${tag.name} (ID: ${tag.id})`);
        });
      } else {
        console.log('   No tags found');
      }
    } catch (err) {
      console.log('   ⚠️ Could not fetch tags:', err.message);
    }

    console.log('\n✅ Done! Check above for existing products, subscriptions, and tags.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listKeapProducts();
