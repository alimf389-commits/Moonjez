export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
    });
    if (request.method !== "POST") return json({ error: "استخدم طلب POST." }, 405);
    if (!env.OPENAI_API_KEY) return json({ error: "محرك الحل غير مفعّل بعد: أضف OPENAI_API_KEY في أسرار الخادم." }, 503);

    let body;
    try { body = await request.json(); } catch { return json({ error: "تعذرت قراءة البيانات المرسلة." }, 400); }
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const image = typeof body.image === "string" ? body.image : "";
    if (!question && !image) return json({ error: "أرسل نص السؤال أو صورته." }, 400);
    if (question.length > 12000) return json({ error: "نص السؤال طويل جداً." }, 413);
    if (image && (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image) || image.length > 9_000_000))
      return json({ error: "الصورة غير مدعومة أو حجمها كبير. استخدم JPG أو PNG أو WebP بحجم أقل من 6 MB." }, 400);

    const content = [];
    content.push({ type: "input_text", text:
      "حل السؤال التالي لطالب السادس العلمي في العراق بصيغة الإجابة الوزارية العراقية. اكتب بالعربية الواضحة. لا تخمّن معطيات غير ظاهرة، وإذا السؤال ناقص أو الصورة غير واضحة فاطلب توضيحاً. حدّد المادة والموضوع إن أمكن. رتّب الإجابة بعناوين: نص السؤال/المعطيات، المطلوب، القانون أو القاعدة، الحل خطوة بخطوة مع التعويض والوحدات، الجواب النهائي بشكل واضح. في الأسئلة النظرية اكتب جواباً امتحانياً مركزاً ودقيقاً، وفي الرياضيات والفيزياء والكيمياء أظهر العمليات والتحويلات. لا تدّعِ أن السؤال وزاري أو تنسبه إلى سنة أو دور من دون مصدر موثوق. إذا توجد أكثر من طريقة، اعتمد الطريقة المدرسية المألوفة. السؤال المكتوب: " + (question || "استخرج السؤال من الصورة وحلّه.") 
    });
    if (image) content.push({ type: "input_image", image_url: image, detail: "high" });

    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          instructions: "أنت مدرس خبير بمناهج السادس العلمي العراقي. الدقة أولاً. لا تختلق نصوصاً أو أجوبة أو مصادر. أجب بصيغة امتحانية وزارية.",
          input: [{ role: "user", content }],
          max_output_tokens: 2200
        })
      });
      const data = await upstream.json();
      if (!upstream.ok) {
        const msg = data?.error?.message || "تعذر الاتصال بمحرك الذكاء الاصطناعي.";
        return json({ error: msg }, upstream.status === 429 ? 429 : 502);
      }
      const answer = (data.output || []).flatMap(item => item.content || [])
        .filter(part => part.type === "output_text").map(part => part.text).join("\n").trim();
      if (!answer) return json({ error: "وصل رد فارغ. جرّب صورة أوضح أو أعد المحاولة." }, 502);
      return json({ answer, model: env.OPENAI_MODEL || "gpt-4.1-mini" });
    } catch {
      return json({ error: "صار خطأ بالاتصال. حاول مرة ثانية." }, 502);
    }
  }
};
