export default async function handler(req, res) {
  try {
    const baseUrl = process.env.PRESTASHOP_API_URL;
    const apiKey = process.env.PRESTASHOP_API_KEY;
    if (!baseUrl || !apiKey) {
      res.setHeader("Content-Type","application/javascript; charset=utf-8");
      return res.status(200).send("window.VINITECA_PRESTASHOP_CATALOG=[];");
    }

    const auth = Buffer.from(apiKey + ":").toString("base64");
    const headers = { Authorization: "Basic " + auth, Accept: "application/json" };
    const base = baseUrl.replace(/\/$/,"");

    async function getJSON(path, params) {
      const url = new URL(base + path);
      Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k,String(v)));
      const r = await fetch(url.toString(), { headers });
      if (!r.ok) throw new Error(path + " -> " + r.status);
      return r.json();
    }

    const [prodData, catData] = await Promise.all([
      getJSON("/products", {
        display: "[id,name,reference,active,id_default_image,id_category_default]",
        limit: "0,1000",
        output_format: "JSON"
      }),
      getJSON("/categories", {
        display: "[id,name,active]",
        limit: "0,1000",
        output_format: "JSON"
      })
    ]);

    const cleanLang = (value) => {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) {
        const first = value.find(x => x && typeof x.value === "string") || value[0];
        return typeof first === "string" ? first : (first?.value || "");
      }
      if (value && typeof value.value === "string") return value.value;
      return "";
    };

    const categories = new Map(
      (Array.isArray(catData.categories) ? catData.categories : []).map(c => [
        String(c.id),
        cleanLang(c.name)
      ])
    );

    const isDemo = (p) => /hummingbird|demo_|framed poster|mug |cushion/i.test(
      [cleanLang(p.name), p.reference || ""].join(" ")
    );

    const products = (Array.isArray(prodData.products) ? prodData.products : [])
      .filter(p => String(p.active) === "1")
      .filter(p => !isDemo(p))
      .map(p => {
        const imageId = p.id_default_image && String(p.id_default_image) !== "0"
          ? String(p.id_default_image)
          : "";
        const category = categories.get(String(p.id_category_default)) || "Otros";
        return {
          id: "ps-" + p.id,
          sourceId: Number(p.id),
          name: cleanLang(p.name),
          reference: p.reference || "",
          category,
          winery: "",
          grape: "",
          region: "",
          country: "",
          vintage: "",
          image: imageId ? "/api/prestashop-image?product=" + encodeURIComponent(p.id) + "&image=" + encodeURIComponent(imageId) : "",
          status: "Consultar disponibilidad"
        };
      });

    res.setHeader("Content-Type","application/javascript; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).send("window.VINITECA_PRESTASHOP_CATALOG=" + JSON.stringify(products) + ";");
  } catch (error) {
    res.setHeader("Content-Type","application/javascript; charset=utf-8");
    return res.status(200).send("window.VINITECA_PRESTASHOP_CATALOG=[];");
  }
}
