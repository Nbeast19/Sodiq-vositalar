// Interfeys tarjimalari (UI yorliqlari). Hadis/sharh matni tarjima qilinmaydi.
// Tanlov localStorage'da saqlanadi; ar -> RTL, en/uz -> LTR. Arabcha manba har doim lang=ar dir=rtl.
(function (root) {
  'use strict';
  var KEY = 'hadis-manba.lang';
  var S = {
    en: {
      'app.name': 'Hadis Manba', 'app.tagline': 'Hadith sources and commentaries — offline, with evidence',
      'nav.library': 'Library', 'nav.search': 'Search', 'nav.installed': 'My books', 'nav.notes': 'Notes',
      'nav.coverage': 'Coverage', 'nav.help': 'Help', 'nav.ai': 'AI (advanced)', 'nav.lang': 'Language',
      'skip': 'Skip to content', 'loading': 'Loading…', 'offline.banner': 'No internet — installed books keep working.',
      'update.available': 'New version available — Update', 'footer': 'Your data stays on this device. Offline use covers installed packages only.',
      'lib.title': 'Library', 'lib.intro': 'Choose a book. Install only the book, or the book together with the commentaries you select. Installed books work without internet.',
      'lib.find': 'Find a book or author (Arabic, English or transliteration)…', 'lib.none': 'No books match.',
      'lib.fixture': 'This public demo contains only SAMPLE test packages (synthetic text, not a real source).',
      'lib.storage': 'Used on this device: {used} · approx. free: {free}',
      'book.main': 'Main text', 'book.comms': 'Commentaries', 'book.noMain': 'No main-text package in the catalog.',
      'book.noComms': 'No commentary in the catalog.', 'book.installBook': 'Install book only',
      'book.installWith': 'Install book + selected commentaries', 'book.notAgain': 'Already installed packages are not downloaded again.',
      'book.open': 'Open', 'book.searchIn': 'Search in this book', 'book.remove': 'Remove', 'book.update': 'Update',
      'book.install': 'Install', 'book.details': 'Details', 'book.records': '{n} records', 'book.occ': '{n} commentary passages',
      'book.linksTo': 'Links to: {target}', 'book.size': '{c} download · ~{i} installed',
      'badge.installed': 'Installed {v}', 'badge.ready': 'Offline ready', 'badge.notReady': 'Readiness not checked',
      'badge.notInstalled': 'Not installed', 'badge.newer': 'Update available: {v}', 'badge.fixture': 'Sample (synthetic)',
      'book.downloadFile': 'Download file', 'book.licence': 'Licence', 'book.permission': 'shared with permission', 'book.attribution': 'Attribution', 'st.manual': 'then use “Install from a file”.', 'rights.public': 'Open to share', 'rights.conditional': 'Conditional licence (non-commercial)', 'rights.local': 'Local use only',
      'rights.label': 'Rights', 'confirm.remove': 'Remove {id}? Your notes are kept.', 'removed': 'Removed',
      'import.title': 'Install from a file', 'import.text': 'Choose a .hmz package file (or a “book + commentaries” bundle). It is verified and installed only on this device.',
      'import.button': 'Choose package file',
      'st.download': '1/6 Downloading', 'st.verify': '2/6 Checking hashes', 'st.space': '3/6 Checking space', 'st.staging': '4/6 Staging',
      'st.activate': '5/6 Installing', 'st.ready': '6/6 Checking offline search', 'st.done': 'Done',
      'st.ok': 'Offline ready', 'st.fail': 'Failed: {msg} — your library was not changed. You can try again.', 'close': 'Close',
      'search.title': 'Search', 'search.placeholder': 'Arabic phrase…', 'search.modeNorm': 'Ignore vowel marks (recommended)',
      'search.modeExact': 'Exact phrase (with marks)', 'search.all': 'Everywhere', 'search.base': 'Main text only',
      'search.comm': 'Commentaries only', 'search.anyAuthor': 'Any commentator', 'search.ownWords': '{name} — own words',
      'search.verifiedOnly': 'Only items whose text and number are verified', 'search.go': 'Search', 'search.busy': 'Searching…',
      'search.count': '{n} results · {ms} ms · only packages on this device', 'search.capped': ' (first 2000 shown)',
      'search.notId': 'A match means the phrase occurs in the text. It is not a verified identification of a hadith.',
      'search.short': 'Short common phrase: many candidates — type a longer phrase.', 'search.more': 'More results exist — refine the query.',
      'search.empty': 'Nothing installed yet. Open the Library and install a book.', 'search.toLib': 'Go to Library',
      'search.mainText': 'Main text', 'search.error': 'Error: {msg}',
      'num.title': 'Find by number', 'num.number': 'Number', 'num.volume': 'Volume (optional)', 'num.go': 'Find',
      'num.none': 'This number was not found in the installed editions.', 'num.many': '{n} candidates (volume/system/edition). None was selected automatically — choose one.',
      'num.noBook': 'No main-text book installed.', 'num.grouped': 'grouped number', 'num.vol': 'vol. {v}',
      'unit.notFound': 'Not found', 'unit.notInstalled': '{id} — this item is not installed on this device or does not exist.',
      'unit.installBase': 'Install the main book', 'unit.bookmark': '☆ Bookmark', 'unit.unbookmark': '★ Remove bookmark',
      'unit.copy': 'Copy citation with source', 'unit.evidence': 'Evidence details', 'unit.comms': 'Installed commentaries',
      'unit.noComms': 'No active link to this item in the installed commentaries. That does not mean no commentary exists.',
      'unit.narrator': 'Narrator closest to the Prophet ﷺ: {name}', 'unit.unknownNarrator': 'unknown (unknown_terminal_person)',
      'unit.fallback': 'fallback (not the identified name): {name}', 'unit.grading': 'Grading: {g} — {who}, {src}',
      'unit.topic': 'Topic: {t} [{o}]', 'unit.idRow': 'input table row — not a printed number', 'unit.legacy': 'old rating: {c} (not re-checked)',
      'unit.noNumber': 'no number', 'note.placeholder': 'Personal note (only on this device)…', 'note.save': 'Save note', 'saved': 'Saved',
      'occ.notInstalled': '{id} is not installed.', 'occ.noLemma': 'The source gives no separate quotation of the hadith here (iqtibos_yoq) — no lemma was invented.',
      'occ.preview': 'Preview window: the end of this commentary is not verified — following text is not attributed to it.',
      'occ.fragment': 'Fragment.', 'occ.cut': '[…] preview ended after {n} characters', 'occ.base': 'Main hadith',
      'occ.general': 'General commentary: one passage covers several hadiths.', 'occ.back': '← Back to the hadith: {num}',
      'occ.pageUnknown': 'page unknown', 'occ.lemma': 'Quoted words ({k}):',
      'role.hadith_text': 'Hadith wording', 'role.commentator': 'Commentator', 'role.quoted_scholar': 'Quoted scholar',
      'role.editor_note': 'Editor’s note', 'role.attribution_unresolved': 'Authorship not determined',
      'scope.full_section': 'full section', 'scope.preview_window': 'preview window', 'scope.fragment': 'fragment',
      'link.active': 'active', 'link.base_not_installed': 'main book not installed', 'link.incompatible_base_version': 'main book version not compatible',
      'link.target_unit_missing': 'target item not found', 'link.not_declared': 'not declared',
      'pk.title': 'My books (installed packages)', 'pk.none': 'Nothing installed.', 'pk.export': 'Save as file', 'pk.rollback': 'Go back to version {v}',
      'pk.license': 'Licence and attribution', 'pk.storage': 'Storage', 'pk.persisted': 'The browser agreed to keep this data.',
      'pk.notPersisted': 'The browser may delete data when space is low. Ask for persistent storage and keep package files as backup.',
      'pk.persist': 'Ask for persistent storage', 'pk.granted': 'Granted', 'pk.denied': 'Refused or not supported',
      'cov.title': 'Coverage and limitations', 'cov.text': 'Installed packages only. A percentage is shown only when the denominator is verified. “The last number exists” does not mean the text is complete.',
      'cov.noPct': 'no percentage — denominator not verified', 'cov.pct': '{p}% (denominator {d})',
      'notes.title': 'Bookmarks and notes', 'notes.text': 'Notes are stored separately from packages and survive updates and removal.',
      'notes.none': 'None yet.', 'notes.export': 'Export notes (JSON)', 'notes.import': 'Restore notes', 'notes.restored': '{n} items restored',
      'notes.bookmark': '★ Bookmark', 'notes.note': '✎ Note',
      'help.title': 'Help', 'help.steps': 'Open the Library|Choose a book|Install the book only, or tick commentaries and install them together|Search or open the book|On a hadith, open an installed commentary; “Back to the hadith” returns|Copy the citation with its source',
      'help.offline': 'After installation the book works without internet. Only installed packages are available offline.',
      'help.install': 'Install this app: iPhone — Safari › Share › Add to Home Screen. Android — Chrome › ⋮ › Install app. Windows/Mac — Chrome or Edge › install icon in the address bar.',
      'help.status': 'Status badges: verified · limited · conflict · not found · not reviewed. “Limited” or “not reviewed” is not firm evidence.',
      'ai.title': 'AI connection (optional, advanced)', 'ai.text': 'The app works fully without AI. Connecting an AI is optional and needs the desktop tool (Python) with the hadis-manba MCP server. The phone app does not connect to AI.',
      'ai.config': 'Settings for an MCP-capable client', 'ai.copy': 'Copy', 'ai.noMcp': 'Without MCP', 'ai.noMcpText': 'Use “Copy citation with source” on a hadith or commentary page and paste it into your AI chat.',
      'copied': 'Copied', 'copyManual': 'Copy the selected text manually', 'error': 'Error',
      'cite.edition': 'Edition', 'cite.quote': 'Quotation', 'cite.scope': 'Scope', 'cite.status': 'Status', 'cite.source': 'Source',
      'cite.fullUnit': 'full local item', 'cite.notes': 'notes'
    },
    ar: {
      'app.name': 'Hadis Manba', 'app.tagline': 'مصادر الحديث وشروحه — بلا إنترنت، مع الدليل',
      'nav.library': 'المكتبة', 'nav.search': 'البحث', 'nav.installed': 'كتبي', 'nav.notes': 'الملاحظات',
      'nav.coverage': 'التغطية', 'nav.help': 'المساعدة', 'nav.ai': 'الذكاء الاصطناعي (متقدم)', 'nav.lang': 'اللغة',
      'skip': 'انتقل إلى المحتوى', 'loading': 'جارٍ التحميل…', 'offline.banner': 'لا يوجد إنترنت — الكتب المثبتة تعمل.',
      'update.available': 'يتوفر إصدار جديد — تحديث', 'footer': 'تبقى بياناتك على هذا الجهاز. العمل بلا إنترنت يشمل الحزم المثبتة فقط.',
      'lib.title': 'المكتبة', 'lib.intro': 'اختر كتابًا. ثبّت الكتاب وحده، أو الكتاب مع الشروح التي تختارها. الكتب المثبتة تعمل بلا إنترنت.',
      'lib.find': 'ابحث عن كتاب أو مؤلف (بالعربية أو الإنجليزية أو بالحروف اللاتينية)…', 'lib.none': 'لا توجد كتب مطابقة.',
      'lib.fixture': 'هذا العرض العام يحتوي على حزم تجريبية فقط (نص اصطناعي، ليس مصدرًا حقيقيًا).',
      'lib.storage': 'المستخدم على هذا الجهاز: {used} · المتاح تقريبًا: {free}',
      'book.main': 'النص الأصلي', 'book.comms': 'الشروح', 'book.noMain': 'لا توجد حزمة للنص الأصلي في الفهرس.',
      'book.noComms': 'لا يوجد شرح في الفهرس.', 'book.installBook': 'تثبيت الكتاب وحده',
      'book.installWith': 'تثبيت الكتاب مع الشروح المختارة', 'book.notAgain': 'الحزم المثبتة سابقًا لا تُنزَّل مرة أخرى.',
      'book.open': 'فتح', 'book.searchIn': 'البحث في هذا الكتاب', 'book.remove': 'حذف', 'book.update': 'تحديث',
      'book.install': 'تثبيت', 'book.details': 'التفاصيل', 'book.records': '{n} سجلًا', 'book.occ': '{n} موضعًا من الشرح',
      'book.linksTo': 'مرتبط بـ: {target}', 'book.size': 'التنزيل {c} · بعد التثبيت ~{i}',
      'badge.installed': 'مثبّت {v}', 'badge.ready': 'جاهز بلا إنترنت', 'badge.notReady': 'لم يُتحقق من الجاهزية',
      'badge.notInstalled': 'غير مثبّت', 'badge.newer': 'يتوفر تحديث: {v}', 'badge.fixture': 'تجريبي (اصطناعي)',
      'book.downloadFile': 'تنزيل الملف', 'book.licence': 'الترخيص', 'book.permission': 'منشور بإذن', 'book.attribution': 'النسبة', 'st.manual': 'ثم استخدم «التثبيت من ملف».', 'rights.public': 'مسموح بمشاركته', 'rights.conditional': 'ترخيص مشروط (غير تجاري)', 'rights.local': 'للاستخدام المحلي فقط',
      'rights.label': 'الحقوق', 'confirm.remove': 'حذف {id}؟ ملاحظاتك تبقى محفوظة.', 'removed': 'تم الحذف',
      'import.title': 'التثبيت من ملف', 'import.text': 'اختر ملف حزمة ‎.hmz (أو حزمة «كتاب + شروح»). يُتحقق منه ويُثبَّت على هذا الجهاز فقط.',
      'import.button': 'اختر ملف الحزمة',
      'st.download': '١/٦ التنزيل', 'st.verify': '٢/٦ فحص البصمات', 'st.space': '٣/٦ فحص المساحة', 'st.staging': '٤/٦ التحضير',
      'st.activate': '٥/٦ التثبيت', 'st.ready': '٦/٦ فحص البحث بلا إنترنت', 'st.done': 'تم',
      'st.ok': 'جاهز بلا إنترنت', 'st.fail': 'تعذّر: {msg} — لم تتغير مكتبتك. يمكنك المحاولة مجددًا.', 'close': 'إغلاق',
      'search.title': 'البحث', 'search.placeholder': 'عبارة عربية…', 'search.modeNorm': 'تجاهل الحركات (موصى به)',
      'search.modeExact': 'العبارة بحروفها وحركاتها', 'search.all': 'في الكل', 'search.base': 'في النص الأصلي فقط',
      'search.comm': 'في الشروح فقط', 'search.anyAuthor': 'أي شارح', 'search.ownWords': '{name} — كلامه هو',
      'search.verifiedOnly': 'ما تحقق نصه ورقمه فقط', 'search.go': 'ابحث', 'search.busy': 'جارٍ البحث…',
      'search.count': '{n} نتيجة · {ms} ملي ثانية · في الحزم المثبتة على هذا الجهاز فقط', 'search.capped': ' (تُعرض أول ٢٠٠٠)',
      'search.notId': 'التطابق يعني ورود العبارة في النص، وليس تحقيقًا مؤكدًا لهوية الحديث.',
      'search.short': 'عبارة قصيرة شائعة: مرشحون كثيرون — اكتب عبارة أطول.', 'search.more': 'هناك نتائج أخرى — حدّد البحث.',
      'search.empty': 'لا شيء مثبت بعد. افتح المكتبة وثبّت كتابًا.', 'search.toLib': 'إلى المكتبة',
      'search.mainText': 'النص الأصلي', 'search.error': 'خطأ: {msg}',
      'num.title': 'البحث بالرقم', 'num.number': 'الرقم', 'num.volume': 'الجزء (اختياري)', 'num.go': 'اعرض',
      'num.none': 'لم يوجد هذا الرقم في الطبعات المثبتة.', 'num.many': '{n} مرشحين (جزء/نظام ترقيم/طبعة). لم يُختر أحدها تلقائيًا — اختر بنفسك.',
      'num.noBook': 'لا يوجد كتاب أصلي مثبت.', 'num.grouped': 'رقم مجمّع', 'num.vol': 'ج {v}',
      'unit.notFound': 'غير موجود', 'unit.notInstalled': '{id} — هذا العنصر غير مثبت على هذا الجهاز أو غير موجود.',
      'unit.installBase': 'تثبيت الكتاب الأصلي', 'unit.bookmark': '☆ علامة مرجعية', 'unit.unbookmark': '★ إزالة العلامة',
      'unit.copy': 'نسخ الاقتباس مع المصدر', 'unit.evidence': 'تفاصيل الدليل', 'unit.comms': 'الشروح المثبتة',
      'unit.noComms': 'لا يوجد ربط فعّال لهذا العنصر في الشروح المثبتة. وهذا لا يعني عدم وجود شرح له.',
      'unit.narrator': 'الراوي الأقرب إلى النبي ﷺ: {name}', 'unit.unknownNarrator': 'غير معروف (unknown_terminal_person)',
      'unit.fallback': 'بديل (ليس الاسم المحدَّد): {name}', 'unit.grading': 'الحكم: {g} — {who}، {src}',
      'unit.topic': 'الموضوع: {t} [{o}]', 'unit.idRow': 'صف في جدول الإدخال — ليس رقمًا مطبوعًا', 'unit.legacy': 'تقدير قديم: {c} (لم يُراجع)',
      'unit.noNumber': 'بلا رقم', 'note.placeholder': 'ملاحظة شخصية (على هذا الجهاز فقط)…', 'note.save': 'حفظ الملاحظة', 'saved': 'تم الحفظ',
      'occ.notInstalled': '{id} غير مثبت.', 'occ.noLemma': 'لا يورد المصدر هنا نص الحديث منفصلًا (iqtibos_yoq) — ولم يُختلق مطلع.',
      'occ.preview': 'نافذة معاينة: نهاية هذا الشرح غير متحقَّق منها — ولا يُنسب إليه ما بعدها.',
      'occ.fragment': 'جزء.', 'occ.cut': '[…] انتهت المعاينة بعد {n} حرفًا', 'occ.base': 'الحديث الأصلي',
      'occ.general': 'شرح عام: موضع واحد يتناول عدة أحاديث.', 'occ.back': '← العودة إلى الحديث: {num}',
      'occ.pageUnknown': 'الصفحة غير معروفة', 'occ.lemma': 'الكلمات المقتبسة ({k}):',
      'role.hadith_text': 'لفظ الحديث', 'role.commentator': 'الشارح', 'role.quoted_scholar': 'عالم منقول عنه',
      'role.editor_note': 'حاشية المحقق', 'role.attribution_unresolved': 'النسبة غير محددة',
      'scope.full_section': 'قسم كامل', 'scope.preview_window': 'نافذة معاينة', 'scope.fragment': 'جزء',
      'link.active': 'فعّال', 'link.base_not_installed': 'الكتاب الأصلي غير مثبت', 'link.incompatible_base_version': 'إصدار الكتاب الأصلي غير متوافق',
      'link.target_unit_missing': 'العنصر المرتبط غير موجود', 'link.not_declared': 'غير مُعلَن',
      'pk.title': 'كتبي (الحزم المثبتة)', 'pk.none': 'لا شيء مثبت.', 'pk.export': 'حفظ كملف', 'pk.rollback': 'الرجوع إلى الإصدار {v}',
      'pk.license': 'الترخيص والإسناد', 'pk.storage': 'التخزين', 'pk.persisted': 'وافق المتصفح على الاحتفاظ بهذه البيانات.',
      'pk.notPersisted': 'قد يحذف المتصفح البيانات عند امتلاء المساحة. اطلب التخزين الدائم واحتفظ بملفات الحزم نسخةً احتياطية.',
      'pk.persist': 'طلب التخزين الدائم', 'pk.granted': 'تمت الموافقة', 'pk.denied': 'رُفض أو غير مدعوم',
      'cov.title': 'التغطية والقيود', 'cov.text': 'الحزم المثبتة فقط. لا تُعرض نسبة مئوية إلا إذا تحقق المقام. وجود آخر رقم لا يعني اكتمال النص.',
      'cov.noPct': 'لا نسبة — المقام غير متحقَّق', 'cov.pct': '{p}٪ (المقام {d})',
      'notes.title': 'العلامات والملاحظات', 'notes.text': 'تُحفظ الملاحظات منفصلة عن الحزم وتبقى بعد التحديث والحذف.',
      'notes.none': 'لا شيء بعد.', 'notes.export': 'تصدير الملاحظات (JSON)', 'notes.import': 'استعادة الملاحظات', 'notes.restored': 'استُعيد {n} عنصرًا',
      'notes.bookmark': '★ علامة', 'notes.note': '✎ ملاحظة',
      'help.title': 'المساعدة', 'help.steps': 'افتح المكتبة|اختر كتابًا|ثبّت الكتاب وحده، أو اختر شروحًا وثبّتها معه|ابحث أو افتح الكتاب|في صفحة الحديث افتح شرحًا مثبتًا؛ و«العودة إلى الحديث» ترجعك|انسخ الاقتباس مع مصدره',
      'help.offline': 'بعد التثبيت يعمل الكتاب بلا إنترنت. لا يتوفر بلا إنترنت إلا ما ثبّتّه.',
      'help.install': 'تثبيت التطبيق: آيفون — سفاري › مشاركة › إضافة إلى الشاشة الرئيسية. أندرويد — كروم › ⋮ › تثبيت التطبيق. ويندوز/ماك — كروم أو إيدج › أيقونة التثبيت في شريط العنوان.',
      'help.status': 'شارات الحالة: متحقَّق · مقيَّد · متعارض · غير موجود · لم يُراجع. «مقيَّد» أو «لم يُراجع» ليس دليلًا قاطعًا.',
      'ai.title': 'الربط بالذكاء الاصطناعي (اختياري، متقدم)', 'ai.text': 'يعمل التطبيق كاملًا بلا ذكاء اصطناعي. الربط اختياري ويحتاج أداة الحاسوب (بايثون) مع خادم MCP الخاص بـ hadis-manba. تطبيق الهاتف لا يتصل بالذكاء الاصطناعي.',
      'ai.config': 'إعدادات لعميل يدعم MCP', 'ai.copy': 'نسخ', 'ai.noMcp': 'بدون MCP', 'ai.noMcpText': 'استخدم «نسخ الاقتباس مع المصدر» في صفحة الحديث أو الشرح والصقه في محادثة الذكاء الاصطناعي.',
      'copied': 'تم النسخ', 'copyManual': 'انسخ النص المحدد يدويًا', 'error': 'خطأ',
      'cite.edition': 'الطبعة', 'cite.quote': 'الاقتباس', 'cite.scope': 'النطاق', 'cite.status': 'الحالة', 'cite.source': 'المصدر',
      'cite.fullUnit': 'عنصر محلي كامل', 'cite.notes': 'ملاحظات'
    },
    uz: {
      'app.name': 'Hadis Manba', 'app.tagline': 'Hadis manbalari va sharhlari — internetsiz, dalil bilan',
      'nav.library': 'Kutubxona', 'nav.search': 'Qidiruv', 'nav.installed': 'Kitoblarim', 'nav.notes': 'Qaydlar',
      'nav.coverage': 'Qamrov', 'nav.help': 'Yordam', 'nav.ai': 'AI (qo‘shimcha)', 'nav.lang': 'Til',
      'skip': 'Asosiy qismga o‘tish', 'loading': 'Yuklanmoqda…', 'offline.banner': 'Internet yo‘q — o‘rnatilgan kitoblar ishlayveradi.',
      'update.available': 'Yangi versiya bor — Yangilash', 'footer': 'Ma’lumot faqat shu qurilmada. Internetsiz ishlash faqat o‘rnatilgan paketlar doirasida.',
      'lib.title': 'Kutubxona', 'lib.intro': 'Kitobni tanlang. Faqat kitobni yoki kitobni tanlangan sharhlar bilan birga o‘rnating. O‘rnatilgan kitob internetsiz ishlaydi.',
      'lib.find': 'Kitob yoki muallifni toping (arabcha, inglizcha yoki lotin yozuvida)…', 'lib.none': 'Mos kitob yo‘q.',
      'lib.fixture': 'Bu ommaviy demo faqat SINOV NAMUNASI paketlaridan iborat (sun’iy matn, haqiqiy manba emas).',
      'lib.storage': 'Qurilmada band: {used} · taxminiy bo‘sh: {free}',
      'book.main': 'Asosiy matn', 'book.comms': 'Sharhlar', 'book.noMain': 'Katalogda asosiy matn paketi yo‘q.',
      'book.noComms': 'Katalogda sharh yo‘q.', 'book.installBook': 'Faqat kitobni o‘rnatish',
      'book.installWith': 'Kitob + tanlangan sharhlarni o‘rnatish', 'book.notAgain': 'Oldin o‘rnatilgan paket qayta yuklanmaydi.',
      'book.open': 'Ochish', 'book.searchIn': 'Shu kitobda qidirish', 'book.remove': 'O‘chirish', 'book.update': 'Yangilash',
      'book.install': 'O‘rnatish', 'book.details': 'Tafsilot', 'book.records': '{n} yozuv', 'book.occ': '{n} sharh joyi',
      'book.linksTo': 'Bog‘lanadi: {target}', 'book.size': 'yuklash {c} · o‘rnatilgach ~{i}',
      'badge.installed': 'O‘rnatilgan {v}', 'badge.ready': 'Oflayn tayyor', 'badge.notReady': 'Tayyorlik tekshirilmagan',
      'badge.notInstalled': 'O‘rnatilmagan', 'badge.newer': 'Yangilanish bor: {v}', 'badge.fixture': 'Sinov (sun’iy)',
      'book.downloadFile': 'Faylni yuklab olish', 'book.licence': 'Litsenziya', 'book.permission': 'ruxsat bilan tarqatiladi', 'book.attribution': 'Manba ko‘rsatish', 'st.manual': 'so‘ng «Fayldan o‘rnatish» bo‘limidan foydalaning.', 'rights.public': 'Tarqatish ruxsat', 'rights.conditional': 'Shartli litsenziya (notijoriy)', 'rights.local': 'Faqat mahalliy',
      'rights.label': 'Huquq', 'confirm.remove': '{id} o‘chirilsinmi? Qaydlaringiz saqlanadi.', 'removed': 'O‘chirildi',
      'import.title': 'Fayldan o‘rnatish', 'import.text': '.hmz paket faylini (yoki “kitob + sharhlar” yig‘masini) tanlang. Tekshiriladi va faqat shu qurilmaga o‘rnatiladi.',
      'import.button': 'Paket faylini tanlash',
      'st.download': '1/6 Yuklash', 'st.verify': '2/6 Xesh tekshiruvi', 'st.space': '3/6 Joy', 'st.staging': '4/6 Staging',
      'st.activate': '5/6 O‘rnatish', 'st.ready': '6/6 Qidiruv tayyorligi', 'st.done': 'Tayyor',
      'st.ok': 'Oflayn tayyor', 'st.fail': 'Xato: {msg} — kutubxonangiz o‘zgarmadi. Qayta urinib ko‘ring.', 'close': 'Yopish',
      'search.title': 'Qidiruv', 'search.placeholder': 'Arabcha ibora…', 'search.modeNorm': 'Harakatsiz (tavsiya)',
      'search.modeExact': 'Aniq ibora (harakat bilan)', 'search.all': 'Hammasida', 'search.base': 'Faqat asos matnda',
      'search.comm': 'Faqat sharhda', 'search.anyAuthor': 'Har qanday shorih', 'search.ownWords': '{name} — o‘z nasri',
      'search.verifiedOnly': 'Faqat matni va raqami tasdiqlanganlar', 'search.go': 'Qidirish', 'search.busy': 'Qidirilmoqda…',
      'search.count': '{n} ta natija · {ms} ms · faqat shu qurilmadagi paketlarda', 'search.capped': ' (birinchi 2000 tasi)',
      'search.notId': 'Moslik — matn ichida uchrashish. Bu tasdiqlangan hadis identifikatsiyasi emas.',
      'search.short': 'Qisqa umumiy ibora: ko‘p nomzod — aniqroq yozing.', 'search.more': 'Yana natijalar bor — so‘rovni aniqlashtiring.',
      'search.empty': 'Hali hech narsa o‘rnatilmagan. Kutubxonadan kitob o‘rnating.', 'search.toLib': 'Kutubxonaga',
      'search.mainText': 'Asos matn', 'search.error': 'Xato: {msg}',
      'num.title': 'Raqam bilan topish', 'num.number': 'Raqam', 'num.volume': 'Jild (ixtiyoriy)', 'num.go': 'Topish',
      'num.none': 'Bu raqam o‘rnatilgan nashrlarda topilmadi.', 'num.many': '{n} ta nomzod (jild/tizim/nashr). Birinchisi avtomatik tanlanmadi — o‘zingiz tanlang.',
      'num.noBook': 'Asosiy kitob o‘rnatilmagan.', 'num.grouped': 'guruhli raqam', 'num.vol': '{v}-jild',
      'unit.notFound': 'Topilmadi', 'unit.notInstalled': '{id} — bu birlik shu qurilmada o‘rnatilmagan yoki mavjud emas.',
      'unit.installBase': 'Asosiy kitobni o‘rnatish', 'unit.bookmark': '☆ Xatcho‘p', 'unit.unbookmark': '★ Xatcho‘pdan olish',
      'unit.copy': 'Manbali iqtibosni nusxalash', 'unit.evidence': 'Dalil tafsiloti', 'unit.comms': 'O‘rnatilgan sharhlar',
      'unit.noComms': 'Bu birlikka o‘rnatilgan sharhlarda faol bog‘lama yo‘q. Bu sharh yozilmagan degani emas.',
      'unit.narrator': 'Nabiy ﷺga eng yaqin roviy: {name}', 'unit.unknownNarrator': 'noma’lum (unknown_terminal_person)',
      'unit.fallback': 'zaxira (topilgan ism emas): {name}', 'unit.grading': 'Hukm: {g} — {who}, {src}',
      'unit.topic': 'Mavzu: {t} [{o}]', 'unit.idRow': 'kirish jadvali qatori — bosma raqam emas', 'unit.legacy': 'eski baho: {c} (qayta tekshirilmagan)',
      'unit.noNumber': 'raqamsiz', 'note.placeholder': 'Shaxsiy qayd (faqat shu qurilmada)…', 'note.save': 'Qaydni saqlash', 'saved': 'Saqlandi',
      'occ.notInstalled': '{id} o‘rnatilmagan.', 'occ.noLemma': 'Manbada alohida hadis iqtibosi yo‘q (iqtibos_yoq) — sun’iy boshlanish qo‘shilmadi.',
      'occ.preview': 'Ko‘rish oynasi: sharh tugash chegarasi tasdiqlanmagan — keyingi matn shu sharhga nisbat berilmaydi.',
      'occ.fragment': 'Parcha.', 'occ.cut': '[…] ko‘rish oynasi {n} belgida tugadi', 'occ.base': 'Asos hadis',
      'occ.general': 'Umumiy sharh: bitta joy bir nechta hadisga tegishli.', 'occ.back': '← Asos hadisga qaytish: {num}',
      'occ.pageUnknown': 'sahifa noma’lum', 'occ.lemma': 'Iqtibos ({k}):',
      'role.hadith_text': 'Hadis lafzi', 'role.commentator': 'Shorih', 'role.quoted_scholar': 'Naql (boshqa olim)',
      'role.editor_note': 'Muhaqqiq hoshiyasi', 'role.attribution_unresolved': 'Mualliflik aniqlanmagan',
      'scope.full_section': 'to‘liq bo‘lim', 'scope.preview_window': 'ko‘rish oynasi', 'scope.fragment': 'parcha',
      'link.active': 'faol', 'link.base_not_installed': 'asosiy kitob o‘rnatilmagan', 'link.incompatible_base_version': 'asosiy kitob versiyasi mos emas',
      'link.target_unit_missing': 'asos birlik topilmadi', 'link.not_declared': 'e’lon qilinmagan',
      'pk.title': 'Kitoblarim (o‘rnatilgan paketlar)', 'pk.none': 'Hech narsa o‘rnatilmagan.', 'pk.export': 'Faylga eksport', 'pk.rollback': 'Oldingi versiyaga qaytish ({v})',
      'pk.license': 'Litsenziya va nisbat', 'pk.storage': 'Saqlash', 'pk.persisted': 'Brauzer ma’lumotni doimiy saqlashga rozi bo‘lgan.',
      'pk.notPersisted': 'Brauzer joy tanqisligida ma’lumotni o‘chirishi mumkin. Doimiy saqlashni so‘rang va paket fayllarini zaxiralang.',
      'pk.persist': 'Doimiy saqlashni so‘rash', 'pk.granted': 'Ruxsat berildi', 'pk.denied': 'Rad etildi yoki qo‘llanmaydi',
      'cov.title': 'Qamrov va cheklovlar', 'cov.text': 'Faqat shu qurilmadagi paketlar. Foiz faqat maxraj tasdiqlangan bo‘lsa ko‘rsatiladi. “Oxirgi raqam bor”dan matn to‘liq degan xulosa chiqmaydi.',
      'cov.noPct': 'foiz yo‘q — maxraj tasdiqlanmagan', 'cov.pct': '{p}% (maxraj {d})',
      'notes.title': 'Xatcho‘p va qaydlar', 'notes.text': 'Qaydlar paketlardan alohida saqlanadi: yangilanish va o‘chirishdan keyin ham qoladi.',
      'notes.none': 'Hali yo‘q.', 'notes.export': 'Qaydlarni eksport (JSON)', 'notes.import': 'Qaydlarni tiklash', 'notes.restored': '{n} ta yozuv tiklandi',
      'notes.bookmark': '★ Xatcho‘p', 'notes.note': '✎ Qayd',
      'help.title': 'Yordam', 'help.steps': 'Kutubxonani oching|Kitobni tanlang|Faqat kitobni o‘rnating yoki sharhlarni belgilab birga o‘rnating|Qidiring yoki kitobni oching|Hadis sahifasida o‘rnatilgan sharhni oching; “Asos hadisga qaytish” qaytaradi|Manbali iqtibosni nusxalang',
      'help.offline': 'O‘rnatilgach kitob internetsiz ishlaydi. Internetsiz faqat o‘rnatilganlar ochiladi.',
      'help.install': 'Ilovani o‘rnatish: iPhone — Safari › Ulashish › Add to Home Screen. Android — Chrome › ⋮ › Ilovani o‘rnatish. Windows/Mac — Chrome yoki Edge › manzil satridagi o‘rnatish belgisi.',
      'help.status': 'Holat belgilari: tasdiqlangan · cheklangan · ixtilofli · topilmagan · ko‘rilmagan. “Cheklangan” yoki “ko‘rilmagan” qat’iy dalil emas.',
      'ai.title': 'AIga ulash (ixtiyoriy, qo‘shimcha)', 'ai.text': 'Dastur AIsiz to‘liq ishlaydi. AI ulash ixtiyoriy: kompyuterda Python bilan hadis-manba MCP server kerak. Telefon ilovasi AIga ulanmaydi.',
      'ai.config': 'MCP qo‘llovchi mijoz sozlamasi', 'ai.copy': 'Nusxalash', 'ai.noMcp': 'MCP’siz', 'ai.noMcpText': 'Hadis yoki sharh sahifasidagi “Manbali iqtibosni nusxalash” kartasini AI suhbatiga joylang.',
      'copied': 'Nusxalandi', 'copyManual': 'Belgilangan matnni qo‘lda nusxalang', 'error': 'Xato',
      'cite.edition': 'Nashr', 'cite.quote': 'Iqtibos', 'cite.scope': 'Qamrov', 'cite.status': 'Holat', 'cite.source': 'Manba',
      'cite.fullUnit': 'to‘liq mahalliy birlik', 'cite.notes': 'cheklov'
    }
  };
  var ENUM = {
    status: {
      en: { verified: 'verified', limited: 'limited', conflict: 'conflict', not_found: 'not found', unreviewed: 'not reviewed', not_applicable: 'not applicable' },
      ar: { verified: 'متحقَّق', limited: 'مقيَّد', conflict: 'متعارض', not_found: 'غير موجود', unreviewed: 'لم يُراجع', not_applicable: 'لا ينطبق' },
      uz: { verified: 'tasdiqlangan', limited: 'cheklangan', conflict: 'ixtilofli', not_found: 'topilmagan', unreviewed: 'ko‘rilmagan', not_applicable: 'tegishli emas' }
    },
    statusKey: {
      en: { text_preservation_status: 'text', number_status: 'number', narrator_identity_status: 'narrator', commentary_link_status: 'link',
        commentary_start_status: 'start', commentary_end_status: 'end', printed_page_status: 'printed page', semantic_review_status: 'content review',
        source_identity_status: 'source', edition_identity_status: 'edition', transport_integrity: 'integrity', rights_status: 'rights' },
      ar: { text_preservation_status: 'النص', number_status: 'الرقم', narrator_identity_status: 'الراوي', commentary_link_status: 'الربط',
        commentary_start_status: 'البداية', commentary_end_status: 'النهاية', printed_page_status: 'الصفحة المطبوعة', semantic_review_status: 'مراجعة المضمون',
        source_identity_status: 'المصدر', edition_identity_status: 'الطبعة', transport_integrity: 'السلامة', rights_status: 'الحقوق' },
      uz: { text_preservation_status: 'matn', number_status: 'raqam', narrator_identity_status: 'roviy', commentary_link_status: 'bog‘lama',
        commentary_start_status: 'boshlanish', commentary_end_status: 'tugash', printed_page_status: 'bosma sahifa', semantic_review_status: 'mazmuniy tekshiruv',
        source_identity_status: 'manba', edition_identity_status: 'nashr', transport_integrity: 'yaxlitlik', rights_status: 'huquq' }
    },
    unitType: {
      en: { hadith: 'hadith', athar_sahabi: 'report of a Companion', athar_tabii: 'report of a Successor', author_statement: 'author’s statement', chapter_heading: 'chapter heading', editor_note: 'editor’s note', introduction: 'introduction', text_block: 'text block (type open)', test_fixture: 'test' },
      ar: { hadith: 'حديث', athar_sahabi: 'أثر صحابي', athar_tabii: 'أثر تابعي', author_statement: 'كلام المؤلف', chapter_heading: 'عنوان باب', editor_note: 'تعليق المحقق', introduction: 'مقدمة', text_block: 'نص (النوع غير محسوم)', test_fixture: 'تجريبي' },
      uz: { hadith: 'hadis', athar_sahabi: 'sahoba asari', athar_tabii: 'tobi’iy asari', author_statement: 'muallif bayoni', chapter_heading: 'bob sarlavhasi', editor_note: 'muharrir izohi', introduction: 'muqaddima', text_block: 'matn bloki (turi ochiq)', test_fixture: 'sinov' }
    },
    attribution: {
      en: { marfu: 'marfūʿ (attribution type, not a grading)', mawquf: 'mawqūf', maqtu: 'maqṭūʿ', mursal: 'mursal (attribution type)', balagh: 'balāgh', not_applicable: 'not applicable', unknown: 'not determined' },
      ar: { marfu: 'مرفوع (نوع النسبة لا حكم)', mawquf: 'موقوف', maqtu: 'مقطوع', mursal: 'مرسل (نوع النسبة)', balagh: 'بلاغ', not_applicable: 'لا ينطبق', unknown: 'غير محسوم' },
      uz: { marfu: 'marfu’ (nisbat turi, hukm emas)', mawquf: 'mavquf', maqtu: 'maqtu’', mursal: 'mursal (nisbat turi)', balagh: 'balog‘', not_applicable: 'tegishli emas', unknown: 'noma’lum' }
    }
  };
  var lang = 'en';
  function detect() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* xususiy rejim */ }
    if (saved && S[saved]) return saved;
    var q = (typeof location !== 'undefined' && /[?&]lang=(en|ar|uz)/.exec(location.search)) || null;
    if (q) return q[1];
    var nav = (typeof navigator !== 'undefined' && (navigator.language || '')).toLowerCase();
    return nav.indexOf('ar') === 0 ? 'ar' : nav.indexOf('uz') === 0 ? 'uz' : 'en';
  }
  function apply() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  function set(l) {
    if (!S[l]) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* saqlanmasa ham ishlaydi */ }
    apply();
  }
  function t(key, vars) {
    var s = (S[lang] && S[lang][key]) || S.en[key] || key;
    // qo'yilgan qiymatlar (raqam, hajm, ID, URL) bidi izolyatsiyasida: FSI … PDI
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null || vars[k] === '' ? '' : '\u2068' + String(vars[k]) + '\u2069'; });
    return s;
  }
  function e(kind, value) {
    var m = ENUM[kind] && (ENUM[kind][lang] || ENUM[kind].en);
    return (m && m[value]) || value;
  }
  lang = detect();
  apply();
  var api = { t: t, e: e, set: set, lang: function () { return lang; }, langs: ['en', 'ar', 'uz'],
    names: { en: 'English', ar: 'العربية', uz: 'O‘zbek' }, strings: S, enums: ENUM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof self !== 'undefined' ? self : this);
