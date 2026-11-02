# تفعيل محرك الحل الوزاري في مُنجز

واجهة الحل موجودة في الموقع، وملف الخادم الآمن موجود في `worker/src/index.js`. لا تضع مفتاح OpenAI داخل `index.html` أو أي ملف عام في GitHub.

## النشر
1. افتح Cloudflare وسجّل الدخول، ثم ادخل إلى **Workers & Pages**.
2. أنشئ Worker جديداً باسم `moonjez-solver`.
3. افتح محرر الكود واستبدل محتواه كاملاً بمحتوى `worker/src/index.js` الموجود بهذا المستودع، ثم اضغط Deploy.
4. من إعدادات الـ Worker افتح **Settings → Variables and Secrets**.
5. أضف Secret باسم `OPENAI_API_KEY`، والصق مفتاح API الخاص بك. لا ترسله في المحادثة ولا تضعه في GitHub.
6. (اختياري) أضف متغيراً عادياً باسم `OPENAI_MODEL` وقيمة `gpt-4.1-mini`.
7. انسخ رابط الـ Worker المنشور، ويكون عادةً بصيغة `https://moonjez-solver.<your-subdomain>.workers.dev`.
8. افتح `index.html` في GitHub وابحث عن `PASTE_CLOUDFLARE_WORKER_URL_HERE` واستبدل النص برابط الـ Worker، ثم احفظ التعديل.

## ملاحظات مهمة
- تحتاج مفتاح OpenAI API فعالاً ورصيد API؛ اشتراك ChatGPT لا يتضمن تلقائياً رصيد API.
- مفتاح API يبقى محفوظاً كـ Secret داخل Cloudflare ولا يظهر للزوار.
- لا تنشر رابط الخادم للعامة قبل التفكير بتحديد معدل الطلبات أو إضافة حماية من الاستخدام المفرط؛ CORS وحده ليس حماية.
- بعد النشر، اختبر بسؤال نصي أولاً ثم بصورة واضحة. النموذج مساعد وقد يخطئ، لذلك يجب مراجعة الحلول مع المنهج والمدرس.

## تفعيل لوحة رفع ملفات PDF

الكود صار يدعم لوحة إدارة ورفع PDF إلى Cloudflare R2، لكن الرفع لا يعمل قبل إعداد التخزين ونشر التحديثات:

1. من Cloudflare افتح **R2 Object Storage** وأنشئ Bucket باسم `moonjez-pdfs` بالضبط.
2. افتح **Workers & Pages** ثم Worker باسم `moonjez-solver` (أو أنشئه إذا لم يكن موجوداً)، وانشر أحدث محتوى الملف `worker/src/index.js` من GitHub.
3. في إعدادات Worker افتح **Settings → Bindings → Add → R2 bucket**، واجعل Variable name هو `PDFS` واختر Bucket `moonjez-pdfs`.
4. من **Settings → Variables and Secrets** أضف ثلاثة Secrets:
   - `ADMIN_PASSWORD`: كلمة مرور قوية خاصة بلوحة إدارة مُنجز.
   - `SESSION_SECRET`: قيمة عشوائية طويلة جداً لا تشاركها مع أحد.
   - `OPENAI_API_KEY`: مفتاح API إذا تريد تفعيل حل الأسئلة بالذكاء الاصطناعي.
5. انشر Worker من جديد بعد إضافة الربط والأسرار.
6. افتح `index.html` في GitHub واستبدل `PASTE_CLOUDFLARE_WORKER_URL_HERE` برابط Worker المنشور، ثم احفظ التعديل وانتظر تحديث GitHub Pages.

بعدها افتح الموقع، ادخل إلى **إدارة الملفات**، سجل الدخول بكلمة المرور التي اخترتها، وحدد المادة ونوع الملف والسنة والدور وارفع PDF. الملفات التي تُرفع بهذه الطريقة تظهر في مكتبة الموقع للطلاب.

حد الملف الواحد 20 MB. لا تضع كلمة المرور أو مفاتيح API داخل GitHub أو ترسلها بالمحادثة.
