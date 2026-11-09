// Demo menu. The server is the source of truth for prices: it recomputes every amount
// from this file and never trusts a total sent by the browser.

export type MenuItem = {
  id: string;
  name: string;
  nameAr: string;
  /** Extra words people use for this dish (English and Arabic), lower case. */
  aliases: string[];
  category: 'mains' | 'sides' | 'drinks' | 'desserts';
  price: number; // USD
  description: string;
  tags: ('spicy' | 'vegetarian' | 'vegan' | 'popular' | 'contains-nuts' | 'gluten-free')[];
  /** Item ids that go well with this one; the waiter suggests them. */
  pairsWith: string[];
};

export const RESTAURANT = {
  name: 'Nile Grill',
  currency: 'USD',
  taxRate: 0.14,
  serviceRate: 0.12,
} as const;

export const MENU: MenuItem[] = [
  { id: 'shawarma', name: 'Chicken shawarma wrap', nameAr: 'شاورما فراخ', aliases: ['shawarma', 'shawerma', 'chicken wrap', 'شاورما', 'شورما'], category: 'mains', price: 7.5, description: 'Marinated chicken, garlic toum, pickles, saj bread.', tags: ['popular'], pairsWith: ['fries', 'lemon-mint'] },
  { id: 'kofta', name: 'Kofta plate', nameAr: 'طبق كفتة', aliases: ['kofta', 'kofta plate', 'كفتة', 'كفته'], category: 'mains', price: 11, description: 'Grilled beef kofta, rice, tahini, salad.', tags: ['gluten-free'], pairsWith: ['tahini-salad', 'lemon-mint'] },
  { id: 'koshari', name: 'Koshari', nameAr: 'كشري', aliases: ['koshari', 'koshary', 'كشري', 'كشرى'], category: 'mains', price: 6, description: 'Rice, lentils, pasta, crispy onions, spicy tomato sauce.', tags: ['vegan', 'popular', 'spicy'], pairsWith: ['karkade'] },
  { id: 'falafel', name: 'Falafel sandwich', nameAr: 'ساندوتش طعمية', aliases: ['falafel', 'taameya', 'tameya', 'طعمية', 'طعميه', 'فلافل'], category: 'mains', price: 4, description: 'Fava bean falafel, tahini, salad, baladi bread.', tags: ['vegan'], pairsWith: ['fries', 'karkade'] },
  { id: 'burger', name: 'Grill burger', nameAr: 'برجر', aliases: ['burger', 'beef burger', 'برجر', 'برغر'], category: 'mains', price: 10, description: 'Beef patty, cheddar, caramelised onion, brioche.', tags: ['popular'], pairsWith: ['fries', 'cola'] },
  { id: 'fries', name: 'Fries', nameAr: 'بطاطس', aliases: ['fries', 'chips', 'french fries', 'بطاطس', 'بطاطا', 'فرايز'], category: 'sides', price: 3.5, description: 'Crispy fries with sumac salt.', tags: ['vegan'], pairsWith: [] },
  { id: 'tahini-salad', name: 'Tahini salad', nameAr: 'سلطة طحينة', aliases: ['tahini', 'tahini salad', 'طحينة', 'طحينه'], category: 'sides', price: 2.5, description: 'Sesame tahini with lemon and cumin.', tags: ['vegan', 'gluten-free', 'contains-nuts'], pairsWith: [] },
  { id: 'cola', name: 'Cola', nameAr: 'كولا', aliases: ['cola', 'coke', 'pepsi', 'soda', 'كولا', 'بيبسي', 'كوكا'], category: 'drinks', price: 2, description: '330 ml can.', tags: ['vegan'], pairsWith: [] },
  { id: 'lemon-mint', name: 'Lemon mint', nameAr: 'ليمون نعناع', aliases: ['lemon mint', 'lemonade', 'lemon', 'ليمون', 'ليمون نعناع'], category: 'drinks', price: 3, description: 'Fresh lemon and mint, blended with ice.', tags: ['vegan'], pairsWith: [] },
  { id: 'karkade', name: 'Karkade', nameAr: 'كركديه', aliases: ['karkade', 'hibiscus', 'كركديه', 'كركدية'], category: 'drinks', price: 2.5, description: 'Cold hibiscus tea.', tags: ['vegan', 'gluten-free'], pairsWith: [] },
  { id: 'om-ali', name: 'Om Ali', nameAr: 'أم علي', aliases: ['om ali', 'umm ali', 'ام علي', 'أم علي'], category: 'desserts', price: 5, description: 'Warm pastry pudding with milk, nuts and raisins.', tags: ['contains-nuts'], pairsWith: [] },
  { id: 'basbousa', name: 'Basbousa', nameAr: 'بسبوسة', aliases: ['basbousa', 'basbosa', 'بسبوسة', 'بسبوسه'], category: 'desserts', price: 4, description: 'Semolina cake soaked in syrup.', tags: ['vegetarian'], pairsWith: [] },
];

export const menuById = (id: string) => MENU.find((m) => m.id === id);
