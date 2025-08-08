// netlify/functions/portfolio.js
import axios from 'axios';

let tokenData = {
  access_token: null,
  expires_at: null
};

async function getToken() {
  if (tokenData.access_token && tokenData.expires_at > Date.now()) {
    return tokenData.access_token;
  }

  const { IOL_USER, IOL_PASS, IOL_CLIENT_ID, IOL_CLIENT_SECRET } = process.env;

  const response = await axios.post('https://api.invertironline.com/token', new URLSearchParams({
    username: IOL_USER,
    password: IOL_PASS,
    grant_type: 'password'
  }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    auth: {
      username: IOL_CLIENT_ID,
      password: IOL_CLIENT_SECRET
    }
  });

  tokenData.access_token = response.data.access_token;
  tokenData.expires_at = Date.now() + (response.data.expires_in * 1000);

  return tokenData.access_token;
}

export async function handler(event, context) {
  try {
    const token = await getToken();
    const response = await axios.get('https://api.invertironline.com/api/v2/portafolio/argentina', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' })
    };
  }
}
