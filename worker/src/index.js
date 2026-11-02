

const b64url=(bytes)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
async function tokenSign(value,secret){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64url(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));}
async function isAdmin(req,env){const auth=req.headers.get("Authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";const [p,s]=token.split(".");if(!p||!s||!env.SESSION_SECRET)return false;if(await tokenSign(p,env.SESSION_SECRET)!==s)return false;try{return JSON.parse(atob(p.replaceAll("-","+").replaceAll("_","/"))).exp>Date.now();}catch{return false;}}
function cleanMeta(v){return String(v||"").trim().replace(/[\/?%*:|"<>]/g,"-").slice(0,100);}


export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    const url=new URL(request.url);
    const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
    if(url.pathname==="/api/admin/login"&&request.method==="POST"){
      if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return send({error:"إعدادات لوحة الإدارة غير مكتملة."},503);
      let b;try{b=await request.json();}catch{return send({error:"بيانات الدخول غير صالحة."},400);}
      if(b.password!==env.ADMIN_PASSWORD)return send({error:"كلمة المرور غير صحيحة."},401);
      const p=b64url(new TextEncoder().encode(JSON.stringify({exp:Date.now()+43200000})));
      return send({token:p+"."+await tokenSign(p,env.SESSION_SECRET)});
    }
    if(url.pathname==="/api/resources"&&request.method==="GET"){
      if(!env.PDFS)return send({error:"تخزين PDF غير مربوط بعد."},503);
      const l=await env.PDFS.list({prefix:"pdfs/",limit:1000});
      return send({resources:l.objects.map(o=>({key:o.key,title:o.customMetadata?.title||"ملف وزاري",subject:o.customMetadata?.subject||"",kind:o.customMetadata?.kind||"ministerial",year:o.customMetadata?.year||"",round:o.customMetadata?.round||""}))});
    }
    if(url.pathname.startsWith("/api/file/")&&request.method==="GET"){
      if(!env.PDFS)return send({error:"التخزين غير متاح."},503);
      const key=decodeURIComponent(url.pathname.slice(10));if(!key.startsWith("pdfs/")||key.includes(".."))return send({error:"الملف غير موجود."},404);
      const obj=await env.PDFS.get(key);if(!obj)return send({error:"الملف غير موجود."},404);
      const headers=new Headers(cors);obj.writeHttpMetadata(headers);headers.set("Content-Type","application/pdf");headers.set("Content-Disposition","inline");return new Response(obj.body,{headers});
    }
    if(url.pathname==="/api/admin/upload"&&request.method==="POST"){
      if(!await isAdmin(request,env))return send({error:"انتهت جلسة الإدارة أو كلمة المرور غير صحيحة."},401);
      if(!env.PDFS)return send({error:"اربط مساحة R2 باسم PDFS."},503);
      let f;try{f=await request.formData();}catch{return send({error:"تعذر قراءة الملف."},400);}
      const file=f.get("file");if(!(file instanceof File)||!file.size)return send({error:"اختار ملف PDF."},400);
      if(file.size>20*1024*1024)return send({error:"الحد الأعلى 20 ميغابايت."},413);
      if(String.fromCharCode(...new Uint8Array(await file.slice(0,5).arrayBuffer()))!=="%PDF-")return send({error:"الملف ليس PDF صالحاً."},415);
      const title=cleanMeta(f.get("title")||(file.name.toLowerCase().endsWith(".pdf")?file.name.slice(0,-4):file.name))||"ملف وزاري";
      const subject=cleanMeta(f.get("subject"));if(!subject)return send({error:"اختار المادة."},400);
      const kind=f.get("kind")==="enrichment"?"enrichment":"ministerial",year=String(f.get("year")||"").replace(/[^0-9]/g,"").slice(0,4),round=cleanMeta(f.get("round"));
      const key="pdfs/"+crypto.randomUUID()+".pdf";
      await env.PDFS.put(key,file.stream(),{httpMetadata:{contentType:"application/pdf"},customMetadata:{title,subject,kind,year,round}});
      return send({ok:true,title});
    }
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
