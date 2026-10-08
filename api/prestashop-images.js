export default async function handler(req, res) {
  try {
    const baseUrl = process.env.PRESTASHOP_API_URL;
    const apiKey = process.env.PRESTASHOP_API_KEY;
    if (!baseUrl || !apiKey) return res.status(500).send("window.PRESTASHOP_IMAGES=[];");

    const auth = Buffer.from(apiKey + ":").toString("base64");
    const url = new URL(baseUrl.replace(/\/$/, "") + "/products");
    url.searchParams.set("display", "[id,name,reference,active,id_default_image]");
    url.searchParams.set("limit", "0,1000");
    url.searchParams.set("output_format", "JSON");

    const response = await fetch(url.toString(), {
      headers: { Authorization: "Basic " + auth, Accept: "application/json" }
    });
    if (!response.ok) return res.status(200).send("window.PRESTASHOP_IMAGES=[];");

    const data = await response.json();
    const products = Array.isArray(data.products) ? data.products : [];
    const cleanName = (value) => {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value[0]?.value || value[0] || "";
      return value?.value || "";
    };
    const isDemo = (p) => /hummingbird|demo_|framed poster|mug |cushion/i.test(
      [cleanName(p.name), p.reference || ""].join(" ")
    );

    const images = products
      .filter(p => p.id_default_image && String(p.id_default_image) !== "0" && !isDemo(p))
      .map(p => ({
        id: Number(p.id),
        name: cleanName(p.name),
        reference: p.reference || "",
        active: String(p.active) === "1",
        image: "/api/prestashop-image?product=" + encodeURIComponent(p.id) + "&image=" + encodeURIComponent(p.id_default_image)
      }));

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    return res.status(200).send("window.PRESTASHOP_IMAGES=" + JSON.stringify(images) + ";");
  } catch (error) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    return res.status(200).send("window.PRESTASHOP_IMAGES=[];");
  }
}
