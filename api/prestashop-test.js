export default async function handler(req, res) {
  try {
    const baseUrl = process.env.PRESTASHOP_API_URL;
    const apiKey = process.env.PRESTASHOP_API_KEY;

    if (!baseUrl || !apiKey) {
      return res.status(500).json({
        connected: false,
        error: "Faltan variables PRESTASHOP_API_URL o PRESTASHOP_API_KEY"
      });
    }

    const url = new URL(baseUrl.replace(/\/$/, "") + "/products");
    url.searchParams.set("display", "[id,name,reference,active]");
    url.searchParams.set("limit", "1");
    url.searchParams.set("output_format", "JSON");

    const auth = Buffer.from(apiKey + ":").toString("base64");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: "Basic " + auth,
        Accept: "application/json"
      }
    });

    const raw = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        connected: false,
        prestashop_status: response.status,
        response_preview: raw.slice(0, 500)
      });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        connected: false,
        error: "PrestaShop respondió, pero no en JSON",
        response_preview: raw.slice(0, 500)
      });
    }

    const sample = Array.isArray(data.products) ? data.products[0] : data.products || null;

    return res.status(200).json({
      connected: true,
      source: "PrestaShop",
      sample_product: sample
    });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
