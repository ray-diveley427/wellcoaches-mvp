// =====================================================================
// List Keap Order Forms and Web Forms
// =====================================================================
// Query the Keap API for all available forms

import fetch from 'node-fetch';

const KEAP_API_BASE = 'https://api.infusionsoft.com/crm/rest/v1';
const KEAP_API_V2_BASE = 'https://api.infusionsoft.com/crm/rest/v2';
const PERSONAL_ACCESS_TOKEN = process.env.KEAP_PERSONAL_ACCESS_TOKEN;

async function keapRequest(endpoint, apiVersion = 'v1') {
  const baseUrl = apiVersion === 'v2' ? KEAP_API_V2_BASE : KEAP_API_BASE;
  const response = await fetch(`${baseUrl}${endpoint}`, {
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

async function listKeapForms() {
  console.log('\n📋 Checking Keap for Order Forms and Web Forms...\n');

  try {
    // Try different API endpoints for forms

    // 1. Try to get order forms
    console.log('1️⃣ Attempting to fetch Order Forms...');
    try {
      const orderForms = await keapRequest('/orders?limit=100');
      console.log('Order Forms Response:', JSON.stringify(orderForms, null, 2));
    } catch (err) {
      console.log('   ⚠️ Order Forms endpoint not accessible:', err.message.substring(0, 100));
    }

    // 2. Try to get e-commerce settings
    console.log('\n2️⃣ Attempting to fetch E-Commerce Settings...');
    try {
      const ecommerce = await keapRequest('/ecommerce/settings');
      console.log('E-Commerce Settings:', JSON.stringify(ecommerce, null, 2));
    } catch (err) {
      console.log('   ⚠️ E-Commerce Settings endpoint not accessible:', err.message.substring(0, 100));
    }

    // 3. Try to get payment links
    console.log('\n3️⃣ Attempting to fetch Payment Links...');
    try {
      const paymentLinks = await keapRequest('/payment-links?limit=100');
      console.log('Payment Links:', JSON.stringify(paymentLinks, null, 2));
    } catch (err) {
      console.log('   ⚠️ Payment Links endpoint not accessible:', err.message.substring(0, 100));
    }

    // 4. Try v2 API for forms
    console.log('\n4️⃣ Attempting to fetch Forms from v2 API...');
    try {
      const formsV2 = await keapRequest('/forms?limit=100', 'v2');
      console.log('Forms (v2 API):', JSON.stringify(formsV2, null, 2));
    } catch (err) {
      console.log('   ⚠️ Forms v2 endpoint not accessible:', err.message.substring(0, 100));
    }

    // 5. Try to get landing pages
    console.log('\n5️⃣ Attempting to fetch Landing Pages...');
    try {
      const landingPages = await keapRequest('/landing-pages?limit=100');
      console.log('Landing Pages:', JSON.stringify(landingPages, null, 2));
    } catch (err) {
      console.log('   ⚠️ Landing Pages endpoint not accessible:', err.message.substring(0, 100));
    }

    // 6. List products with more details
    console.log('\n6️⃣ Products with subscription details:');
    try {
      const products = await keapRequest('/products?limit=100');
      if (products.products && products.products.length > 0) {
        products.products
          .filter(p => p.product_name && (
            p.product_name.toLowerCase().includes('subscription') ||
            p.product_name.toLowerCase().includes('membership') ||
            p.product_name.toLowerCase().includes('multi-perspective')
          ))
          .forEach(product => {
            console.log(`\n   📦 ${product.product_name} (ID: ${product.id})`);
            console.log(`      Price: $${product.product_price || 0}`);
            console.log(`      Status: ${product.status || 'N/A'}`);
            if (product.subscription_plan_id) {
              console.log(`      Subscription Plan ID: ${product.subscription_plan_id}`);
            }
            if (product.url) {
              console.log(`      URL: ${product.url}`);
            }
          });
      }
    } catch (err) {
      console.log('   ⚠️ Could not fetch products:', err.message);
    }

    console.log('\n\n💡 NOTE: Keap may not expose order forms through the REST API.');
    console.log('   You may need to check the Keap web interface at:');
    console.log('   https://app.infusionsoft.com → E-Commerce → Order Forms\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listKeapForms();
