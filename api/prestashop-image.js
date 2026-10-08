export default async function handler(req, res) {
  try {
    const baseUrl = process.env.PRESTASHOP_API_URL;
    const apiKey = process.env.PRESTASHOP_API_KEY;
    const product = String(req.query.product || "").replace(/[^0-9]/g, "");
    const image = String(req.query.image || "").replace(/[^0-9]/g, "");

    if (!baseUrl || !apiKey) return res.status(500).end("Missing PrestaShop configuration");
    if (!product || !image) return res.status(400).end("Missing product/image");

    const auth = Buffer.from(apiKey + ":").toString("base64");
    const url = baseUrl.replace(/\/$/, "") + "/images/products/" + product + "/" + image;

    const response = await fetch(url, {
      headers: { Authorization: "Basic " + auth, Accept: "image/*" },
      redirect: "follow"
    });

    if (!response.ok) return res.status(response.status).end("Image unavailable");

    const type = response.headers.get("content-type") || "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Content-Length", String(bytes.length));
    return res.status(200).send(bytes);
  } catch (error) {
    return res.status(500).end("Image proxy error");
  }
}
