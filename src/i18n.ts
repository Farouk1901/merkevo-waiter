// Interface languages. The AI understands far more; these are the languages the screens are written in.
export const LANGS = [
  { code: 'en', label: 'English', speech: 'en-US' },
  { code: 'ar', label: 'العربية', speech: 'ar-EG', rtl: true },
  { code: 'fr', label: 'Français', speech: 'fr-FR' },
  { code: 'es', label: 'Español', speech: 'es-ES' },
  { code: 'de', label: 'Deutsch', speech: 'de-DE' },
  { code: 'it', label: 'Italiano', speech: 'it-IT' },
  { code: 'tr', label: 'Türkçe', speech: 'tr-TR' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];

type Dict = Record<string, string>;

const en: Dict = {
  table: 'Table {n}',
  menu: 'Menu', waiter: 'Waiter', order: 'Your order', all: 'All',
  mains: 'Mains', sides: 'Sides', drinks: 'Drinks', desserts: 'Desserts',
  add: 'Add', added: 'Added',
  welcome: 'Hi! I’m your waiter. Tell me what you’d like, in any language. You can also tap the mic and speak.',
  placeholder: 'e.g. two koshari and a karkade',
  send: 'Send', listening: 'Listening…', speak: 'Speak your order', thinking: 'Thinking…',
  empty: 'Nothing yet. Tap Add, or just tell the waiter.',
  clear: 'Clear', goesWell: 'Goes well with',
  subtotal: 'Subtotal', service: 'Service 12%', vat: 'VAT 14%', total: 'Total',
  viewOrder: 'View order', items: '{n} items', item: '1 item',
  payBill: 'Pay the bill', splitIt: 'Split it',
  splitPlaceholder: 'Who pays for what?', split: 'Split',
  equalShare: 'Equal share', paid: 'Paid', payAs: 'Pay as {name}',
  sendKitchen: 'Send to kitchen', sentKitchen: 'Sent to the kitchen', kitchenNote: 'The kitchen gets your order in its own language.',
  allPaid: 'All paid. Thank you!', receipt: 'Receipt', newTable: 'New table',
  locked: 'Part of the bill is already paid, so the order can’t change now. Please ask the staff.',
  online: 'Online', offline: 'Offline',
  aiDevice: 'AI on this device', aiCloud: 'AI in the cloud', aiRules: 'Offline mode',
  demoPay: 'Payments: demo', sandbox: 'PayPal sandbox',
  srcDevice: 'On-device · Gemini Nano', srcCloud: 'Cloud · Gemini', srcRules: 'Offline rules',
  footer: 'Demo restaurant. Payments run in the PayPal sandbox; no real money moves.',
  getModel: 'Get on-device AI', close: 'Close',
  ex1: '2 shawarma no garlic and a lemon mint', ex2: 'What is vegan here?', ex3: 'Remove the fries',
  sx1: 'Sara pays the burger and half the fries, Omar the rest', sx2: 'Split it 3 ways',
};

const ar: Dict = {
  table: 'ترابيزة {n}',
  menu: 'المنيو', waiter: 'الجرسون', order: 'طلبك', all: 'الكل',
  mains: 'أطباق رئيسية', sides: 'جانبي', drinks: 'مشروبات', desserts: 'حلويات',
  add: 'أضف', added: 'اتضاف',
  welcome: 'أهلًا! أنا الجرسون. قولّي تحب تاكل إيه، بأي لغة. ممكن كمان تدوس على المايك وتتكلم.',
  placeholder: 'مثلًا: اتنين كشري وكركديه',
  send: 'إرسال', listening: 'بسمعك…', speak: 'اطلب بصوتك', thinking: 'لحظة…',
  empty: 'لسه مفيش حاجة. دوس أضف أو قول للجرسون.',
  clear: 'مسح', goesWell: 'يمشي معاه',
  subtotal: 'المجموع', service: 'خدمة 12%', vat: 'ضريبة 14%', total: 'الإجمالي',
  viewOrder: 'شوف الطلب', items: '{n} أصناف', item: 'صنف واحد',
  payBill: 'ادفع الحساب', splitIt: 'قسّم الحساب',
  splitPlaceholder: 'مين يدفع إيه؟', split: 'قسّم',
  equalShare: 'نصيب متساوي', paid: 'اتدفع', payAs: 'ادفع نصيب {name}',
  sendKitchen: 'ابعت للمطبخ', sentKitchen: 'الطلب وصل المطبخ', kitchenNote: 'المطبخ بيستلم الطلب بلغته.',
  allPaid: 'الحساب اتدفع بالكامل. شكرًا لزيارتكم!', receipt: 'الإيصال', newTable: 'ترابيزة جديدة',
  locked: 'جزء من الحساب اتدفع، فمش هينفع نغيّر الطلب دلوقتي. اسأل الموظف من فضلك.',
  online: 'متصل', offline: 'غير متصل',
  aiDevice: 'ذكاء على الجهاز', aiCloud: 'ذكاء في السحابة', aiRules: 'وضع بدون إنترنت',
  demoPay: 'الدفع: تجريبي', sandbox: 'PayPal تجريبي',
  srcDevice: 'على الجهاز · Gemini Nano', srcCloud: 'السحابة · Gemini', srcRules: 'قواعد بدون إنترنت',
  footer: 'مطعم تجريبي. الدفع في بيئة PayPal التجريبية، ولا تُخصم أموال حقيقية.',
  getModel: 'نزّل الذكاء على الجهاز', close: 'إغلاق',
  ex1: 'اتنين شاورما بدون ثوم وليمون نعناع', ex2: 'إيه الأكل النباتي عندكم؟', ex3: 'شيل البطاطس',
  sx1: 'سارة تدفع البرجر ونص البطاطس، وعمر الباقي', sx2: 'قسّمها على 3',
};

const fr: Dict = {
  table: 'Table {n}',
  menu: 'Menu', waiter: 'Serveur', order: 'Votre commande', all: 'Tout',
  mains: 'Plats', sides: 'Accompagnements', drinks: 'Boissons', desserts: 'Desserts',
  add: 'Ajouter', added: 'Ajouté',
  welcome: 'Bonjour ! Je suis votre serveur. Dites-moi ce qui vous ferait plaisir, dans n’importe quelle langue. Vous pouvez aussi parler au micro.',
  placeholder: 'ex. deux koshari et un karkadé',
  send: 'Envoyer', listening: 'Je vous écoute…', speak: 'Commander à la voix', thinking: 'Un instant…',
  empty: 'Rien pour l’instant. Touchez Ajouter, ou parlez au serveur.',
  clear: 'Vider', goesWell: 'Se marie bien avec',
  subtotal: 'Sous-total', service: 'Service 12 %', vat: 'TVA 14 %', total: 'Total',
  viewOrder: 'Voir la commande', items: '{n} articles', item: '1 article',
  payBill: 'Payer l’addition', splitIt: 'Partager',
  splitPlaceholder: 'Qui paie quoi ?', split: 'Partager',
  equalShare: 'Part égale', paid: 'Payé', payAs: 'Payer pour {name}',
  sendKitchen: 'Envoyer en cuisine', sentKitchen: 'Envoyé en cuisine', kitchenNote: 'La cuisine reçoit la commande dans sa langue.',
  allPaid: 'Tout est réglé. Merci !', receipt: 'Reçu', newTable: 'Nouvelle table',
  locked: 'Une partie de l’addition est payée : la commande ne peut plus changer. Demandez au personnel.',
  online: 'En ligne', offline: 'Hors ligne',
  aiDevice: 'IA sur l’appareil', aiCloud: 'IA dans le cloud', aiRules: 'Mode hors ligne',
  demoPay: 'Paiement : démo', sandbox: 'PayPal sandbox',
  srcDevice: 'Sur l’appareil · Gemini Nano', srcCloud: 'Cloud · Gemini', srcRules: 'Règles hors ligne',
  footer: 'Restaurant de démonstration. Paiements en sandbox PayPal ; aucun argent réel.',
  getModel: 'Installer l’IA locale', close: 'Fermer',
  ex1: 'Deux shawarmas sans ail et une citronnade à la menthe', ex2: 'Qu’avez-vous de végan ?', ex3: 'Enlevez les frites',
  sx1: 'Sara paie le burger et la moitié des frites, Omar le reste', sx2: 'Partager en 3',
};

const es: Dict = {
  table: 'Mesa {n}',
  menu: 'Carta', waiter: 'Camarero', order: 'Tu pedido', all: 'Todo',
  mains: 'Principales', sides: 'Acompañantes', drinks: 'Bebidas', desserts: 'Postres',
  add: 'Añadir', added: 'Añadido',
  welcome: '¡Hola! Soy tu camarero. Dime qué te apetece, en cualquier idioma. También puedes pulsar el micro y hablar.',
  placeholder: 'p. ej. dos koshari y un karkadé',
  send: 'Enviar', listening: 'Te escucho…', speak: 'Pide con la voz', thinking: 'Un momento…',
  empty: 'Todavía nada. Pulsa Añadir o díselo al camarero.',
  clear: 'Vaciar', goesWell: 'Combina con',
  subtotal: 'Subtotal', service: 'Servicio 12 %', vat: 'IVA 14 %', total: 'Total',
  viewOrder: 'Ver pedido', items: '{n} productos', item: '1 producto',
  payBill: 'Pagar la cuenta', splitIt: 'Dividir',
  splitPlaceholder: '¿Quién paga qué?', split: 'Dividir',
  equalShare: 'Parte igual', paid: 'Pagado', payAs: 'Pagar por {name}',
  sendKitchen: 'Enviar a cocina', sentKitchen: 'Enviado a cocina', kitchenNote: 'La cocina recibe el pedido en su idioma.',
  allPaid: 'Todo pagado. ¡Gracias!', receipt: 'Recibo', newTable: 'Nueva mesa',
  locked: 'Parte de la cuenta ya está pagada, así que el pedido no puede cambiar. Pregunta al personal.',
  online: 'En línea', offline: 'Sin conexión',
  aiDevice: 'IA en el dispositivo', aiCloud: 'IA en la nube', aiRules: 'Modo sin conexión',
  demoPay: 'Pagos: demo', sandbox: 'PayPal sandbox',
  srcDevice: 'En el dispositivo · Gemini Nano', srcCloud: 'Nube · Gemini', srcRules: 'Reglas sin conexión',
  footer: 'Restaurante de demostración. Pagos en el sandbox de PayPal; no se mueve dinero real.',
  getModel: 'Instalar IA local', close: 'Cerrar',
  ex1: 'Dos shawarmas sin ajo y una limonada con menta', ex2: '¿Qué tenéis vegano?', ex3: 'Quita las patatas',
  sx1: 'Sara paga la hamburguesa y la mitad de las patatas, Omar el resto', sx2: 'Divídela entre 3',
};

const de: Dict = {
  table: 'Tisch {n}',
  menu: 'Karte', waiter: 'Kellner', order: 'Ihre Bestellung', all: 'Alle',
  mains: 'Hauptgerichte', sides: 'Beilagen', drinks: 'Getränke', desserts: 'Desserts',
  add: 'Hinzufügen', added: 'Hinzugefügt',
  welcome: 'Hallo! Ich bin Ihr Kellner. Sagen Sie mir, was Sie möchten, in jeder Sprache. Sie können auch das Mikrofon antippen und sprechen.',
  placeholder: 'z. B. zwei Koshari und ein Karkade',
  send: 'Senden', listening: 'Ich höre zu…', speak: 'Per Sprache bestellen', thinking: 'Einen Moment…',
  empty: 'Noch nichts. Tippen Sie auf Hinzufügen oder sagen Sie es dem Kellner.',
  clear: 'Leeren', goesWell: 'Passt gut zu',
  subtotal: 'Zwischensumme', service: 'Service 12 %', vat: 'MwSt. 14 %', total: 'Gesamt',
  viewOrder: 'Bestellung ansehen', items: '{n} Artikel', item: '1 Artikel',
  payBill: 'Rechnung bezahlen', splitIt: 'Aufteilen',
  splitPlaceholder: 'Wer zahlt was?', split: 'Aufteilen',
  equalShare: 'Gleicher Anteil', paid: 'Bezahlt', payAs: 'Für {name} bezahlen',
  sendKitchen: 'An die Küche senden', sentKitchen: 'An die Küche gesendet', kitchenNote: 'Die Küche erhält die Bestellung in ihrer Sprache.',
  allPaid: 'Alles bezahlt. Danke!', receipt: 'Beleg', newTable: 'Neuer Tisch',
  locked: 'Ein Teil der Rechnung ist bezahlt, die Bestellung kann nicht mehr geändert werden. Bitte fragen Sie das Personal.',
  online: 'Online', offline: 'Offline',
  aiDevice: 'KI auf dem Gerät', aiCloud: 'KI in der Cloud', aiRules: 'Offline-Modus',
  demoPay: 'Zahlung: Demo', sandbox: 'PayPal-Sandbox',
  srcDevice: 'Auf dem Gerät · Gemini Nano', srcCloud: 'Cloud · Gemini', srcRules: 'Offline-Regeln',
  footer: 'Demo-Restaurant. Zahlungen laufen in der PayPal-Sandbox; es fließt kein echtes Geld.',
  getModel: 'Lokale KI installieren', close: 'Schließen',
  ex1: 'Zwei Schawarma ohne Knoblauch und eine Zitronen-Minze', ex2: 'Was ist bei Ihnen vegan?', ex3: 'Die Pommes bitte weg',
  sx1: 'Sara zahlt den Burger und die halben Pommes, Omar den Rest', sx2: 'Durch 3 teilen',
};

const it: Dict = {
  table: 'Tavolo {n}',
  menu: 'Menù', waiter: 'Cameriere', order: 'Il tuo ordine', all: 'Tutto',
  mains: 'Piatti principali', sides: 'Contorni', drinks: 'Bevande', desserts: 'Dolci',
  add: 'Aggiungi', added: 'Aggiunto',
  welcome: 'Ciao! Sono il tuo cameriere. Dimmi cosa desideri, in qualsiasi lingua. Puoi anche toccare il microfono e parlare.',
  placeholder: 'es. due koshari e un karkadè',
  send: 'Invia', listening: 'Ti ascolto…', speak: 'Ordina a voce', thinking: 'Un momento…',
  empty: 'Ancora niente. Tocca Aggiungi o dillo al cameriere.',
  clear: 'Svuota', goesWell: 'Si abbina con',
  subtotal: 'Subtotale', service: 'Servizio 12%', vat: 'IVA 14%', total: 'Totale',
  viewOrder: 'Vedi ordine', items: '{n} articoli', item: '1 articolo',
  payBill: 'Paga il conto', splitIt: 'Dividi',
  splitPlaceholder: 'Chi paga cosa?', split: 'Dividi',
  equalShare: 'Quota uguale', paid: 'Pagato', payAs: 'Paga per {name}',
  sendKitchen: 'Invia in cucina', sentKitchen: 'Inviato in cucina', kitchenNote: 'La cucina riceve l’ordine nella sua lingua.',
  allPaid: 'Tutto pagato. Grazie!', receipt: 'Ricevuta', newTable: 'Nuovo tavolo',
  locked: 'Parte del conto è già pagata, quindi l’ordine non può cambiare. Chiedi al personale.',
  online: 'Online', offline: 'Offline',
  aiDevice: 'IA sul dispositivo', aiCloud: 'IA nel cloud', aiRules: 'Modalità offline',
  demoPay: 'Pagamenti: demo', sandbox: 'PayPal sandbox',
  srcDevice: 'Sul dispositivo · Gemini Nano', srcCloud: 'Cloud · Gemini', srcRules: 'Regole offline',
  footer: 'Ristorante dimostrativo. Pagamenti nella sandbox PayPal; nessun denaro reale.',
  getModel: 'Installa IA locale', close: 'Chiudi',
  ex1: 'Due shawarma senza aglio e una limonata alla menta', ex2: 'Cosa avete di vegano?', ex3: 'Togli le patatine',
  sx1: 'Sara paga l’hamburger e metà patatine, Omar il resto', sx2: 'Dividi in 3',
};

const tr: Dict = {
  table: 'Masa {n}',
  menu: 'Menü', waiter: 'Garson', order: 'Siparişiniz', all: 'Tümü',
  mains: 'Ana yemekler', sides: 'Yan ürünler', drinks: 'İçecekler', desserts: 'Tatlılar',
  add: 'Ekle', added: 'Eklendi',
  welcome: 'Merhaba! Ben garsonunuzum. Ne istediğinizi herhangi bir dilde söyleyin. Mikrofona dokunup konuşabilirsiniz de.',
  placeholder: 'ör. iki koshari ve bir karkade',
  send: 'Gönder', listening: 'Dinliyorum…', speak: 'Sesle sipariş ver', thinking: 'Bir saniye…',
  empty: 'Henüz bir şey yok. Ekle’ye dokunun ya da garsona söyleyin.',
  clear: 'Temizle', goesWell: 'Yanına yakışır',
  subtotal: 'Ara toplam', service: 'Servis %12', vat: 'KDV %14', total: 'Toplam',
  viewOrder: 'Siparişi gör', items: '{n} ürün', item: '1 ürün',
  payBill: 'Hesabı öde', splitIt: 'Böl',
  splitPlaceholder: 'Kim neyi ödüyor?', split: 'Böl',
  equalShare: 'Eşit pay', paid: 'Ödendi', payAs: '{name} adına öde',
  sendKitchen: 'Mutfağa gönder', sentKitchen: 'Mutfağa gönderildi', kitchenNote: 'Mutfak siparişi kendi dilinde alır.',
  allPaid: 'Hepsi ödendi. Teşekkürler!', receipt: 'Fiş', newTable: 'Yeni masa',
  locked: 'Hesabın bir kısmı ödendi, sipariş artık değişemez. Lütfen personele sorun.',
  online: 'Çevrimiçi', offline: 'Çevrimdışı',
  aiDevice: 'Cihazda yapay zekâ', aiCloud: 'Bulutta yapay zekâ', aiRules: 'Çevrimdışı mod',
  demoPay: 'Ödeme: demo', sandbox: 'PayPal sandbox',
  srcDevice: 'Cihazda · Gemini Nano', srcCloud: 'Bulut · Gemini', srcRules: 'Çevrimdışı kurallar',
  footer: 'Demo restoran. Ödemeler PayPal sandbox’ta; gerçek para hareket etmez.',
  getModel: 'Cihaz yapay zekâsını indir', close: 'Kapat',
  ex1: 'İki sarımsaksız şavurma ve bir limonlu nane', ex2: 'Vegan ne var?', ex3: 'Patatesi çıkar',
  sx1: 'Sara burgeri ve patatesin yarısını, Omar gerisini ödüyor', sx2: '3’e böl',
};

const DICTS: Record<Lang, Dict> = { en, ar, fr, es, de, it, tr };

export function makeT(lang: Lang) {
  const d = DICTS[lang] || en;
  return (key: string, vars: Record<string, string | number> = {}) =>
    (d[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Menu names and descriptions per language (English and Arabic live in shared/menu.ts). */
const MENU_T: Partial<Record<Lang, Record<string, [string, string]>>> = {
  fr: {
    shawarma: ['Wrap shawarma poulet', 'Poulet mariné, sauce toum à l’ail, pickles, pain saj.'],
    kofta: ['Assiette de kofta', 'Kofta de bœuf grillée, riz, tahiné, salade.'],
    koshari: ['Koshari', 'Riz, lentilles, pâtes, oignons croustillants, sauce tomate épicée.'],
    falafel: ['Sandwich falafel', 'Falafel de fèves, tahiné, salade, pain baladi.'],
    burger: ['Burger grillé', 'Steak de bœuf, cheddar, oignons caramélisés, brioche.'],
    fries: ['Frites', 'Frites croustillantes au sel de sumac.'],
    'tahini-salad': ['Salade tahiné', 'Tahiné au citron et au cumin.'],
    cola: ['Cola', 'Canette 33 cl.'],
    'lemon-mint': ['Citron-menthe', 'Citron frais et menthe, mixés avec de la glace.'],
    karkade: ['Karkadé', 'Infusion d’hibiscus glacée.'],
    'om-ali': ['Om Ali', 'Pudding chaud de pâte feuilletée, lait, noix et raisins secs.'],
    basbousa: ['Basboussa', 'Gâteau de semoule imbibé de sirop.'],
  },
  es: {
    shawarma: ['Wrap de shawarma de pollo', 'Pollo marinado, salsa toum de ajo, encurtidos, pan saj.'],
    kofta: ['Plato de kofta', 'Kofta de ternera a la parrilla, arroz, tahini, ensalada.'],
    koshari: ['Koshari', 'Arroz, lentejas, pasta, cebolla crujiente, salsa de tomate picante.'],
    falafel: ['Bocadillo de falafel', 'Falafel de habas, tahini, ensalada, pan baladi.'],
    burger: ['Hamburguesa a la parrilla', 'Carne de ternera, cheddar, cebolla caramelizada, brioche.'],
    fries: ['Patatas fritas', 'Patatas crujientes con sal de zumaque.'],
    'tahini-salad': ['Ensalada de tahini', 'Tahini con limón y comino.'],
    cola: ['Cola', 'Lata de 330 ml.'],
    'lemon-mint': ['Limón con menta', 'Limón fresco y menta, batidos con hielo.'],
    karkade: ['Karkadé', 'Té frío de hibisco.'],
    'om-ali': ['Om Ali', 'Pudin caliente de hojaldre con leche, frutos secos y pasas.'],
    basbousa: ['Basbusa', 'Bizcocho de sémola bañado en almíbar.'],
  },
  de: {
    shawarma: ['Hähnchen-Schawarma-Wrap', 'Mariniertes Hähnchen, Knoblauch-Toum, Pickles, Saj-Brot.'],
    kofta: ['Kofta-Teller', 'Gegrillte Rinder-Kofta, Reis, Tahini, Salat.'],
    koshari: ['Koshari', 'Reis, Linsen, Nudeln, Röstzwiebeln, scharfe Tomatensauce.'],
    falafel: ['Falafel-Sandwich', 'Falafel aus Ackerbohnen, Tahini, Salat, Baladi-Brot.'],
    burger: ['Grill-Burger', 'Rindfleisch-Patty, Cheddar, karamellisierte Zwiebeln, Brioche.'],
    fries: ['Pommes', 'Knusprige Pommes mit Sumach-Salz.'],
    'tahini-salad': ['Tahini-Salat', 'Sesam-Tahini mit Zitrone und Kreuzkümmel.'],
    cola: ['Cola', '330-ml-Dose.'],
    'lemon-mint': ['Zitrone-Minze', 'Frische Zitrone und Minze, mit Eis gemixt.'],
    karkade: ['Karkade', 'Kalter Hibiskustee.'],
    'om-ali': ['Om Ali', 'Warmer Blätterteig-Pudding mit Milch, Nüssen und Rosinen.'],
    basbousa: ['Basbousa', 'Grießkuchen in Sirup.'],
  },
  it: {
    shawarma: ['Wrap shawarma di pollo', 'Pollo marinato, salsa toum all’aglio, sottaceti, pane saj.'],
    kofta: ['Piatto di kofta', 'Kofta di manzo alla griglia, riso, tahina, insalata.'],
    koshari: ['Koshari', 'Riso, lenticchie, pasta, cipolla croccante, salsa di pomodoro piccante.'],
    falafel: ['Panino falafel', 'Falafel di fave, tahina, insalata, pane baladi.'],
    burger: ['Hamburger alla griglia', 'Hamburger di manzo, cheddar, cipolla caramellata, brioche.'],
    fries: ['Patatine', 'Patatine croccanti con sale al sommacco.'],
    'tahini-salad': ['Insalata di tahina', 'Tahina con limone e cumino.'],
    cola: ['Cola', 'Lattina da 330 ml.'],
    'lemon-mint': ['Limone e menta', 'Limone fresco e menta, frullati con ghiaccio.'],
    karkade: ['Karkadè', 'Tè freddo all’ibisco.'],
    'om-ali': ['Om Ali', 'Budino caldo di sfoglia con latte, frutta secca e uvetta.'],
    basbousa: ['Basbousa', 'Torta di semolino imbevuta di sciroppo.'],
  },
  tr: {
    shawarma: ['Tavuk şavurma dürüm', 'Marine tavuk, sarımsaklı toum sos, turşu, saç ekmeği.'],
    kofta: ['Köfte tabağı', 'Izgara dana köfte, pilav, tahin, salata.'],
    koshari: ['Koshari', 'Pirinç, mercimek, makarna, çıtır soğan, acı domates sosu.'],
    falafel: ['Falafel sandviç', 'Bakla falafeli, tahin, salata, baladi ekmeği.'],
    burger: ['Izgara burger', 'Dana köfte, çedar, karamelize soğan, brioche.'],
    fries: ['Patates kızartması', 'Sumak tuzlu çıtır patates.'],
    'tahini-salad': ['Tahin salatası', 'Limon ve kimyonlu susam tahini.'],
    cola: ['Kola', '330 ml kutu.'],
    'lemon-mint': ['Limonlu nane', 'Taze limon ve nane, buzla karıştırılmış.'],
    karkade: ['Karkade', 'Soğuk hibiskus çayı.'],
    'om-ali': ['Om Ali', 'Süt, kuruyemiş ve kuru üzümlü sıcak milföy tatlısı.'],
    basbousa: ['Revani (basbousa)', 'Şerbetli irmik tatlısı.'],
  },
};

export function itemText(lang: Lang, m: { id: string; name: string; nameAr: string; description: string }): { name: string; description: string } {
  if (lang === 'ar') return { name: m.nameAr, description: AR_DESC[m.id] ?? m.description };
  const t = MENU_T[lang]?.[m.id];
  return t ? { name: t[0], description: t[1] } : { name: m.name, description: m.description };
}

const AR_DESC: Record<string, string> = {
  shawarma: 'فراخ متبلة، ثومية، مخلل، عيش صاج.',
  kofta: 'كفتة لحمة مشوية، رز، طحينة، سلطة.',
  koshari: 'رز وعدس ومكرونة وبصل مقرمش وصلصة طماطم حارة.',
  falafel: 'طعمية فول، طحينة، سلطة، عيش بلدي.',
  burger: 'لحمة بقري، شيدر، بصل مكرمل، عيش بريوش.',
  fries: 'بطاطس مقرمشة بملح السماق.',
  'tahini-salad': 'طحينة بالليمون والكمون.',
  cola: 'كانز 330 مل.',
  'lemon-mint': 'ليمون فريش ونعناع مع تلج.',
  karkade: 'كركديه ساقع.',
  'om-ali': 'أم علي سخنة باللبن والمكسرات والزبيب.',
  basbousa: 'بسبوسة بالسميد والشربات.',
};

const TAGS: Record<string, Partial<Record<Lang, string>>> = {
  spicy: { ar: 'حار', fr: 'épicé', es: 'picante', de: 'scharf', it: 'piccante', tr: 'acı' },
  vegetarian: { ar: 'نباتي', fr: 'végétarien', es: 'vegetariano', de: 'vegetarisch', it: 'vegetariano', tr: 'vejetaryen' },
  vegan: { ar: 'نباتي صرف', fr: 'végan', es: 'vegano', de: 'vegan', it: 'vegano', tr: 'vegan' },
  popular: { ar: 'الأكثر طلبًا', fr: 'populaire', es: 'popular', de: 'beliebt', it: 'popolare', tr: 'popüler' },
  'contains-nuts': { ar: 'فيه مكسرات', fr: 'fruits à coque', es: 'frutos secos', de: 'enthält Nüsse', it: 'frutta a guscio', tr: 'kuruyemiş içerir' },
  'gluten-free': { ar: 'خالي من الجلوتين', fr: 'sans gluten', es: 'sin gluten', de: 'glutenfrei', it: 'senza glutine', tr: 'glütensiz' },
};
export const tagText = (lang: Lang, tag: string) => TAGS[tag]?.[lang] ?? tag.replace('-', ' ');

export const LANG_NAME_EN: Record<Lang, string> = { en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', tr: 'Turkish' };

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('mw-lang');
    if (saved && LANGS.some((l) => l.code === saved)) return saved as Lang;
  } catch { /* ignore */ }
  const nav = (navigator.language || 'en').slice(0, 2);
  return (LANGS.find((l) => l.code === nav)?.code ?? 'en') as Lang;
}
