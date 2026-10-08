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

    const [prodData, catData, featureData, valueData] = await Promise.all([
      getJSON("/products", {
        display: "full",
        limit: "0,1000",
        output_format: "JSON"
      }),
      getJSON("/categories", {
        display: "[id,name,link_rewrite,id_parent,active]",
        limit: "0,1000",
        output_format: "JSON"
      }),
      getJSON("/product_features", {
        display: "[id,name]",
        limit: "0,1000",
        output_format: "JSON"
      }),
      getJSON("/product_feature_values", {
        display: "[id,id_feature,value]",
        limit: "0,5000",
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
        { name: cleanLang(c.name), slug: cleanLang(c.link_rewrite), parent: String(c.id_parent || "") }
      ])
    );
    const featureNames = new Map(
      (Array.isArray(featureData.product_features) ? featureData.product_features : []).map(f => [
        String(f.id), cleanLang(f.name)
      ])
    );
    const featureValues = new Map(
      (Array.isArray(valueData.product_feature_values) ? valueData.product_feature_values : []).map(v => [
        String(v.id), { featureId: String(v.id_feature), value: cleanLang(v.value) }
      ])
    );

    const countryMap = {
      "argentina":"Argentina","australia":"Australia","austria":"Austria","brasil":"Brasil",
      "chile":"Chile","espana":"España","españa":"España","estados unidos":"Estados Unidos",
      "usa":"Estados Unidos","francia":"Francia","alemania":"Alemania","italia":"Italia",
      "nueva zelanda":"Nueva Zelanda","peru":"Perú","perú":"Perú","portugal":"Portugal",
      "sudafrica":"Sudáfrica","sudáfrica":"Sudáfrica","turquia":"Turquía","turquía":"Turquía",
      "uruguay":"Uruguay"
    };
    const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

    function countryFromProduct(p) {
      const associations = p.associations || {};
      const pf = Array.isArray(associations.product_features) ? associations.product_features : [];
      for (const link of pf) {
        const fv = featureValues.get(String(link.id_feature_value || link.id || ""));
        const fid = String(link.id_feature || link.id || fv?.featureId || "");
        const fname = norm(featureNames.get(fid));
        const value = fv?.value || "";
        if (/(pais|country|origen|procedencia)/.test(fname)) {
          const matched = countryMap[norm(value)];
          if (matched) return matched;
          if (value) return value;
        }
      }

      const catLinks = Array.isArray(associations.categories) ? associations.categories : [];
      for (const link of catLinks) {
        const cat = categories.get(String(link.id));
        if (!cat) continue;
        const matched = countryMap[norm(cat.name)];
        if (matched) return matched;
      }

      const defaultCat = categories.get(String(p.id_category_default));
      if (defaultCat) {
        const matched = countryMap[norm(defaultCat.name)];
        if (matched) return matched;
      }
      return "";
    }

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
        const category = categories.get(String(p.id_category_default))?.name || "Otros";
        const numericPrice = Number.parseFloat(String(p.price || "0")) || 0;
        const productSlug = cleanLang(p.link_rewrite);
        const categoryData = categories.get(String(p.id_category_default));
        const categorySlug = categoryData?.slug || "";
        const shopOrigin = new URL(baseUrl).origin;
        const productUrl = productSlug
          ? shopOrigin + "/" + (categorySlug ? encodeURIComponent(categorySlug) + "/" : "") + p.id + "-" + encodeURIComponent(productSlug) + ".html"
          : shopOrigin + "/index.php?controller=product&id_product=" + encodeURIComponent(p.id);
        const combinations = p.associations && Array.isArray(p.associations.combinations) ? p.associations.combinations : [];
        const hasCombinations = combinations.length > 0;
        const addToCartUrl = hasCombinations
          ? productUrl
          : shopOrigin + "/index.php?controller=cart&add=1&id_product=" + encodeURIComponent(p.id) + "&qty=1";
        return {
          id: "ps-" + p.id,
          sourceId: Number(p.id),
          name: cleanLang(p.name),
          reference: p.reference || "",
          category,
          country: countryFromProduct(p),
          winery: "",
          grape: "",
          region: "",
          vintage: "",
          price: numericPrice,
          currency: "PEN",
          image: imageId ? "/api/prestashop-image?product=" + encodeURIComponent(p.id) + "&image=" + encodeURIComponent(imageId) : "",
          productUrl,
          addToCartUrl,
          hasCombinations,
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
