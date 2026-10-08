export default async function handler(req, res) {
  try {
    const baseUrl = process.env.PRESTASHOP_API_URL;
    const apiKey = process.env.PRESTASHOP_API_KEY;

    if (!baseUrl || !apiKey) {
      return res.status(500).json({ ok: false, error: "Missing PrestaShop env vars" });
    }

    const auth = Buffer.from(apiKey + ":").toString("base64");
    const headers = { Authorization: "Basic " + auth, Accept: "application/json" };

    const productsUrl = new URL(baseUrl.replace(/\/$/, "") + "/products");
    productsUrl.searchParams.set("display", "[id,name,reference,active,price,id_default_image]");
    productsUrl.searchParams.set("limit", "0,500");
    productsUrl.searchParams.set("output_format", "JSON");

    const response = await fetch(productsUrl.toString(), { headers });
    const raw = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        prestashop_status: response.status,
        response_preview: raw.slice(0, 500)
      });
    }

    const data = JSON.parse(raw);
    const products = Array.isArray(data.products) ? data.products : [];

    const normalized = products.map((p) => {
      const imageId = p.id_default_image && String(p.id_default_image) !== "0"
        ? String(p.id_default_image)
        : null;

      return {
        id: Number(p.id),
        name: typeof p.name === "string" ? p.name : (p.name?.[0]?.value || ""),
        reference: p.reference || "",
        active: String(p.active) === "1",
        price: p.price || null,
        id_default_image: imageId,
        default_image_url: imageId
          ? `https://viniteca.com.pe/api/images/products/${p.id}/${imageId}`
          : null
      };
    });

    const active = normalized.filter(p => p.active);
    const withImage = normalized.filter(p => p.id_default_image);
    const demo = normalized.filter(p => /hummingbird|demo_|framed poster|mug |cushion/i.test(
      [p.name, p.reference].join(" ")
    ));

    return res.status(200).json({
      ok: true,
      totals: {
        products: normalized.length,
        active: active.length,
        inactive: normalized.length - active.length,
        with_default_image: withImage.length,
        without_default_image: normalized.length - withImage.length,
        likely_demo: demo.length
      },
      sample_real_candidates: normalized
        .filter(p => !demo.some(d => d.id === p.id))
        .slice(0, 25),
      sample_demo: demo.slice(0, 10)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
