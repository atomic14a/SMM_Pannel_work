/**
 * SMM Panel API Helper
 * Standard SMM API endpoints used by all major panels
 */

/**
 * Make an API call to an SMM panel provider
 */
export async function smmApiCall(apiUrl, apiKey, action, params = {}) {
  try {
    const body = new URLSearchParams({
      key: apiKey,
      action,
      ...params,
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all services from a provider
 */
export async function fetchServices(apiUrl, apiKey) {
  return smmApiCall(apiUrl, apiKey, 'services');
}

/**
 * Get account balance
 */
export async function fetchBalance(apiUrl, apiKey) {
  return smmApiCall(apiUrl, apiKey, 'balance');
}

/**
 * Place a new order
 */
export async function placeOrder(apiUrl, apiKey, { service, link, quantity, comments, runs, interval }) {
  const params = { service: String(service), link, quantity: String(quantity) };
  if (comments) params.comments = comments;
  if (runs) params.runs = String(runs);
  if (interval) params.interval = String(interval);
  return smmApiCall(apiUrl, apiKey, 'add', params);
}

/**
 * Check order status
 */
export async function checkOrderStatus(apiUrl, apiKey, orderId) {
  return smmApiCall(apiUrl, apiKey, 'status', { order: String(orderId) });
}

/**
 * Check multiple order statuses
 */
export async function checkMultipleOrderStatuses(apiUrl, apiKey, orderIds) {
  return smmApiCall(apiUrl, apiKey, 'status', { orders: orderIds.join(',') });
}

/**
 * Cancel one or more orders
 */
export async function cancelOrders(apiUrl, apiKey, orderIds) {
  return smmApiCall(apiUrl, apiKey, 'multi_cancel', { orders: orderIds.join(',') });
}
