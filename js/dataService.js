// ============================================================
//  Data Service — طبقة مركزية للوصول لبيانات النظام
// ============================================================
//
//  البنية المعمارية:
//
//    data/*.json (مصدر مرجعي، لاحقًا = GitHub Repository)
//            │
//            ▼
//    DataService.init()  →  يزرع القيم في Local Cache (localStorage)
//            │                لو الصفحة أول مرة تفتح (Cache فاضي)
//            ▼
//    localStorage['cs_*']  (Local Cache — نفس المفاتيح القديمة تمامًا،
//                            عشان أي كود موجود يفضل شغال زي ما هو)
//            │
//            ▼
//    UI (pos.html, inventory.html, crm.html, settings.html ...)
//
//  الفكرة: الصفحات مش محتاجة تتغير في طريقة قراءتها للبيانات اليومية
//  (لسه بتستخدم localStorage.getItem('cs_items') إلخ زي الأول)، لكن
//  "البيانات الأصلية" (Seed) بقت في data/ مش Hardcoded جوه كل صفحة.
//
//  لما يتحول المشروع لـ Electron مستقبلًا:
//    - fetchJSON() هنا هي المكان الوحيد اللي هيتغير ليقرأ من ملفات
//      محلية أو من GitHub (raw.githubusercontent.com) بدل fetch('./data/..')
//    - checkForUpdates() هي المكان اللي هيتحول لخدمة مزامنة حقيقية
//      (GitHub Sync Service) من غير ما تتغير أي صفحة HTML تانية.
// ============================================================

// نقطة التحكم الوحيدة في "مصدر" البيانات المرجعية.
// دلوقتي بيانات محلية. لاحقًا تتغير لرابط GitHub Raw أو تُبنى
// ديناميكيًا حسب بيئة التشغيل (Browser / Electron).
const DATA_BASE_URL = './data/';

async function fetchJSON(relativePath) {
  try {
    const res = await fetch(DATA_BASE_URL + relativePath, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.warn('DataService: تعذر تحميل', relativePath, err);
    return null;
  }
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('DataService: تعذر الحفظ في الكاش', key, err);
  }
}

// -----------------------------------------------------------
// سجل النطاقات (Domains): كل نطاق بيانات مربوط بمفتاح الكاش
// القديم (بدون تغيير) وملف البيانات المرجعي المقابل له.
// -----------------------------------------------------------
export const DOMAINS = {
  categories:  { key: 'cs_cats',      file: 'catalog/categories.json' },
  items:       { key: 'cs_items',     file: 'catalog/items.json' },
  recipes:     { key: 'cs_recipes',   file: 'catalog/recipes.json' },
  stock:       { key: 'cs_stock',     file: 'inventory/stock.json' },
  tables:      { key: 'cs_tables',    file: 'tables/tables.json' },
  customers:   { key: 'cs_customers', file: 'crm/customers.json' },
  suppliers:   { key: 'cs_suppliers', file: 'crm/suppliers.json' },
  captains:    { key: 'cs_captains',  file: 'crm/captains.json' },
  staff:       { key: 'cs_staff',     file: 'crm/staff.json' },
  storeConfig: { key: 'cs_configs',   file: 'settings/store-config.json', isObject: true }
};

const seedCache = {}; // آخر نسخة معروفة من data/*.json لكل نطاق
let manifestCache = null;

async function getManifest() {
  if (manifestCache) return manifestCache;
  manifestCache = await fetchJSON('manifest.json');
  return manifestCache;
}

function isEmptyValue(domain, value) {
  if (value === null || value === undefined) return true;
  return domain.isObject ? Object.keys(value).length === 0 : value.length === 0;
}

// تحميل نطاق واحد: يجيب النسخة المرجعية من data/، ولو الكاش
// المحلي فاضي (أول تشغيل) بيزرعه فيه بنفس المفتاح القديم.
// آمن يتنادي أكتر من مرة (Idempotent).
async function loadDomain(name) {
  const domain = DOMAINS[name];
  if (!domain) throw new Error('DataService: نطاق غير معروف "' + name + '"');

  const seed = await fetchJSON(domain.file);
  if (seed !== null) seedCache[name] = seed;

  const existing = readCache(domain.key);
  if (isEmptyValue(domain, existing) && seed !== null) {
    writeCache(domain.key, seed);
    return seed;
  }
  return existing !== null ? existing : (seed ?? (domain.isObject ? {} : []));
}

// نقطة الدخول الرئيسية: تُستدعى أول حاجة في كل صفحة (بـ top-level
// await) قبل أي كود بيقرأ بيانات، لضمان إن الكاش المحلي مزروع من
// data/ أول ما الصفحة تفتح لأول مرة.
async function init(names) {
  await Promise.all(names.map(loadDomain));
}

// قراءة/كتابة مباشرة (اختيارية) لأي كود جديد يفضّل يستخدم
// DataService بدل التعامل مع localStorage مباشرة.
function get(name) {
  const domain = DOMAINS[name];
  if (!domain) throw new Error('DataService: نطاق غير معروف "' + name + '"');
  const existing = readCache(domain.key);
  if (existing !== null) return existing;
  return seedCache[name] ?? (domain.isObject ? {} : []);
}

function set(name, value) {
  const domain = DOMAINS[name];
  if (!domain) throw new Error('DataService: نطاق غير معروف "' + name + '"');
  writeCache(domain.key, value);
  window.dispatchEvent(new CustomEvent('cs:datachange', { detail: { domain: name, value } }));
}

function getSeed(name) {
  return seedCache[name] ?? null;
}

// -----------------------------------------------------------
// جاهزية المزامنة المستقبلية مع GitHub.
// دلوقتي بترجع نفس ملفات data/ المحلية (بدون تعارض مع أي حاجة
// موجودة)، لكنها مصممة عشان لما DATA_BASE_URL يتحول لرابط
// GitHub Raw مستقبلًا، نفس الدالة دي تبقى هي "GitHub Sync
// Service" الحقيقية بدون ما نلمس أي صفحة تانية.
// بترجع true لو فيه تحديثات جديدة اتكشفت (Event بيتبعت لكل نطاق).
// -----------------------------------------------------------
async function checkForUpdates(names = Object.keys(DOMAINS)) {
  const manifest = await getManifest();
  let anyChanged = false;

  for (const name of names) {
    const domain = DOMAINS[name];
    const fresh = await fetchJSON(domain.file);
    if (fresh === null) continue;

    const previousSeed = seedCache[name];
    if (JSON.stringify(fresh) !== JSON.stringify(previousSeed)) {
      seedCache[name] = fresh;
      anyChanged = true;
      // ملاحظة: هنا بنكتفي بإرسال إشعار (Event) بدل الكتابة الفورية
      // فوق بيانات المستخدم المحلية. استراتيجية الدمج/الاستبدال
      // النهائية هتتحدد لما تتفعل المزامنة الحقيقية مع GitHub.
      window.dispatchEvent(new CustomEvent('cs:dataupdateavailable', {
        detail: { domain: name, fresh }
      }));
    }
  }

  return { manifest, anyChanged };
}

export const DataService = {
  init,
  loadDomain,
  get,
  set,
  getSeed,
  getManifest,
  checkForUpdates,
  DOMAINS
};

export default DataService;
