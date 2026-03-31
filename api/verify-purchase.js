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
    console.log('[Android] purchaseState:', data.purchaseState);
    // purchaseState: 0 = Acheté ✅, 1 = Annulé, 2 = En attente
    return { isValid: data.purchaseState === 0, purchaseState: data.purchaseState };
  } catch (err) {
    console.error('[Android] Error:', err.message);
    return { isValid: false, error: err.message };
  }
}

async function verifyIos(productId, receiptData) {
  const secret = process.env.APPLE_SHARED_SECRET;
  if (!secret) return { isValid: false, error: 'APPLE_SHARED_SECRET not set' };

  const payload = JSON.stringify({
    'receipt-data': receiptData,
    'password': secret,
    'exclude-old-transactions': true,
  });

  // 1. Essayer production
  let result = await callApple(APPLE_PROD_URL, payload);

  // 2. Status 21007 = receipt sandbox → retry sandbox
  if (result && result.status === 21007) {
    console.log('[iOS] Sandbox receipt detected, retrying sandbox...');
    result = await callApple(APPLE_SAND_URL, payload);
  }

  if (!result || result.status !== 0) {
    return { isValid: false, appleStatus: result?.status };
  }

  // Vérifier que le productId est dans le receipt
  const allTxn = [
    ...(result.receipt?.in_app || []),
    ...(result.latest_receipt_info || []),
  ];
  const match = allTxn.find(t => t.product_id === productId);

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
