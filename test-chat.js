// Test chat API directly
const BACKEND_URL = 'https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1';

async function testChat() {
  console.log('Testing chat endpoint...');

  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'test-user',
      },
      body: JSON.stringify({
        messages: [{role: 'user', content: 'Hello'}],
        stream: false,
        max_tokens: 100
      })
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));

    const text = await response.text();
    console.log('Response:', text);

    if (!response.ok) {
      console.log('Error response:', text);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testChat();