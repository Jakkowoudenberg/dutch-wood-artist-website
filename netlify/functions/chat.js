const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async function(event, context) {
  if(event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if(event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { messages } = JSON.parse(event.body);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: process.env.JAKKO_SYSTEM_PROMPT,
      messages: messages
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: response.content[0].text })
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
