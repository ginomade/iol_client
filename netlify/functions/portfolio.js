// netlify/functions/portfolio.js
// Backend sin dependencias externas: usa fetch nativo de Node 18+
// Asegurate de que el sitio use Node 18+ (por ejemplo con "engines" en package.json)

let tokenData = {
  access_token: null,
  expires_at: 0,
};

async function getToken() {
  // Reutiliza el token mientras no haya expirado
  if (tokenData.access_token && Date.now() < tokenData.expires_at) {
    return tokenData.access_token;
  }

  const { IOL_USER, IOL_PASS } = process.env;
  if (!IOL_USER || !IOL_PASS) {
    throw new Error("Faltan variables de entorno IOL_USER / IOL_PASS");
  }

  const body = new URLSearchParams({
    username: IOL_USER,
    password: IOL_PASS,
    grant_type: "password",
  });

  const resp = await fetch("https://api.invertironline.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Error obteniendo token (${resp.status}): ${txt}`);
  }

  const json = await resp.json();
  tokenData.access_token = json.access_token;
  tokenData.expires_at = Date.now() + (json.expires_in || 0) * 1000;
  return tokenData.access_token;
}

export async function handler(event, context) {
  try {
    const token = await getToken();

    const resp = await fetch(
      "https://api.invertironline.com/api/v2/portafolio/argentina",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "IOL API error", detail: txt }),
      };
    }

    const data = await resp.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("portfolio function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error", detail: String(err) }),
    };
  }
}
