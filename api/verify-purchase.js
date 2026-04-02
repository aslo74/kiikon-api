const { google } = require('googleapis');
const ANDROID_PACKAGE = 'fr.cubith.bluffr';
const APPLE_PROD_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SAND_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const VALID_PRODUCTS = new Set(['kiikon.pack.1', 'kiikon.pack.2', 'kiikon.pack.3']);
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { platform, productId, purchaseToken, receiptData } = req.body;
    if (!platform || !productId) {
      return res.status(400).json({ error: 'Missing fields: platform, productId' });
    }
    if (!VALID_PRODUCTS.has(productId)) {
      return res.status(400).json({ error: `Invalid productId: ${productId}` });
    }
    if (platform === 'google_play') {
      return res.status(200).json(await verifyAndroid(productId, purchaseToken));
    } else if (platform === 'app_store') {
      return res.status(200).json(await verifyIos(productId, receiptData));
    }
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  } catch (err) {
    console.error('[verify-purchase] Error:', err);
    return res.status(500).json({ isValid: false, error: 'Server error' });
  }
};
async function verifyAndroid(productId, purchaseToken) {
  try {
    const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const publisher = google.androidpublisher({ version: 'v3', auth });
    const { data } = await publisher.purchases.products.get({
      packageName: ANDROID_PACKAGE,
      productId,
      token: purchaseToken,
    });
    console.log('[Android] purchaseState:', data.purchaseState, '| acknowledgementState:', data.acknowledgementState);
    const isValid = data.purchaseState === 0;
    if (isValid) {
      try {
        await publisher.purchases.products.consume({
          packageName: ANDROID_PACKAGE,
          productId,
          token: purchaseToken,
        });
        console.log('[Android] Purchase consumed ✅ — produit libéré pour rachat');
      } catch (consumeErr) {
        console.log('[Android] Consume info:', consumeErr.message);
      }
    }
    return { isValid, purchaseState: data.purchaseState };
  } catch (err) {
    console.error('[Android] Error:', err.message);
    return { isValid: false, error: err.message };
  }
}
async function verifyIos(productId, receiptData) {
  console.log('[iOS] verifyIos called — productId:', productId, '| receiptData length:', receiptData ? receiptData.length : 'NULL');
  
  const secret = process.env.APPLE_SHARED_SECRET;
  if (!secret) {
    console.error('[iOS] APPLE_SHARED_SECRET not set');
    return { isValid: false, error: 'APPLE_SHARED_SECRET not set' };
  }
  if (!receiptData) {
    console.error('[iOS] receiptData is null or empty');
    return { isValid: false, error: 'receiptData missing' };
  }

  // Normaliser base64url → base64 standard (Apple exige base64 avec + et /)
  const normalizedReceipt = receiptData
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s/g, '');
  console.log('[iOS] Receipt normalized length:', normalizedReceipt.length);

  const payload = JSON.stringify({
    'receipt-data': normalizedReceipt,
    'password': secret,
    'exclude-old-transactions': true,
  });

  console.log('[iOS] Calling Apple prod URL...');
  let result = await callApple(APPLE_PROD_URL, payload);
  console.log('[iOS] Apple prod response status:', result?.status);

  if (result && result.status === 21007) {
    console.log('[iOS] Sandbox receipt detected, retrying sandbox...');
    result = await callApple(APPLE_SAND_URL, payload);
    console.log('[iOS] Apple sandbox response status:', result?.status);
  }

  if (!result || result.status !== 0) {
    console.error('[iOS] Invalid receipt — appleStatus:', result?.status);
    return { isValid: false, appleStatus: result?.status };
  }

  const allTxn = [
    ...(result.receipt?.in_app || []),
    ...(result.latest_receipt_info || []),
  ];
  console.log('[iOS] Total transactions found:', allTxn.length);
  console.log('[iOS] Looking for productId:', productId);
  
  const match = allTxn.find(t => t.product_id === productId);
  console.log('[iOS] Match found:', !!match, '| transactionId:', match?.transaction_id);

  return {
    isValid: !!match,
    transactionId: match?.transaction_id,
    environment: result.environment,
  };
}
async function callApple(url, body) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return resp.ok ? await resp.json() : null;
  } catch (err) {
    console.error('[iOS] Apple call error:', err.message);
    return null;
  }
}
