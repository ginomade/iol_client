// netlify/functions/dashboard.js (IOL)
// Función serverless que agrega en una sola respuesta: portafolio + estado de cuenta
// Sin dependencias externas (usa fetch nativo). Requiere Node 18+.

let tokenData = { access_token: null, expires_at: 0 };

async function getToken() {
  if (tokenData.access_token && Date.now() < tokenData.expires_at) return tokenData.access_token;

  const { IOL_USER, IOL_PASS } = process.env;
  if (!IOL_USER || !IOL_PASS) throw new Error("Faltan IOL_USER / IOL_PASS");

  const body = new URLSearchParams({ username: IOL_USER, password: IOL_PASS, grant_type: "password" });
  const resp = await fetch("https://api.invertironline.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Error token (${resp.status}): ${await resp.text()}`);
  }
  const json = await resp.json();
  tokenData.access_token = json.access_token;
  tokenData.expires_at = Date.now() + (json.expires_in || 0) * 1000;
  return tokenData.access_token;
}

async function iolGet(path) {
  const token = await getToken();
  const resp = await fetch(`https://api.invertironline.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    return { ok: false, status: resp.status, text: await resp.text() };
  }
  return { ok: true, json: await resp.json() };
}

export async function handler() {
  try {
    const [portfolioRes, estadoRes] = await Promise.all([
      iolGet("/api/v2/portafolio/argentina"),
      iolGet("/api/v2/estadocuenta"),
    ]);

    if (!portfolioRes.ok || !estadoRes.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "IOL API error",
          portfolio: portfolioRes.ok ? undefined : { status: portfolioRes.status, detail: portfolioRes.text },
          estadoCuenta: estadoRes.ok ? undefined : { status: estadoRes.status, detail: estadoRes.text },
        }),
      };
    }

    const portfolio = portfolioRes.json || {};
    const estadoCuenta = estadoRes.json || {};

    // Derivados útiles para el dashboard
    const cuentas = Array.isArray(estadoCuenta.cuentas) ? estadoCuenta.cuentas : [];
    const totales = cuentas.reduce(
      (acc, c) => {
        acc.total += Number(c.total || 0);
        acc.disponible += Number(c.disponible || 0);
        acc.titulosValorizados += Number(c.titulosValorizados || 0);
        acc.comprometido += Number(c.comprometido || 0);
        return acc;
      },
      { total: 0, disponible: 0, titulosValorizados: 0, comprometido: 0 }
    );

    const activos = Array.isArray(portfolio.activos) ? portfolio.activos : [];
    const distribucion = activos.map((a) => ({
      simbolo: a?.titulo?.simbolo || "-",
      descripcion: a?.titulo?.descripcion || a?.titulo?.simbolo || "(sin descripción)",
      valorizado: Number(a?.valorizado || 0),
      cantidad: Number(a?.cantidad || 0),
      ultimoPrecio: Number(a?.ultimoPrecio || 0),
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio, estadoCuenta, totales, distribucion }),
    };
  } catch (err) {
    console.error("dashboard function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error", detail: String(err) }),
    };
  }
}
