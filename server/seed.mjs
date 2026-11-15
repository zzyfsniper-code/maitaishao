export const MEALS = ['breakfast', 'lunch', 'dinner'];
export const MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
export const MENU_RULES = { version: 'demo-v2', repeatGapDays: 1, mainDishCount: 5 };
export function dateInZone(time = new Date(), zone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
}
export function addDays(date, n) { return new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
export function monday(date) { return addDays(date, -((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7)); }
export function nextWeek(date = dateInZone()) { return addDays(monday(date), 7); }
const dishes = [
  ['番茄炖牛腩', 'meat', '牛腩:150:g,番茄:120:g,洋葱:30:g', '牛肉', '牛腩焯水洗净；番茄和洋葱炒香，加入牛腩与水；炖至牛肉软烂，全熟后调味。'],
  ['香菇蒸鸡', 'meat', '鸡腿肉:150:g,香菇:60:g,姜:5:g', '鸡肉', '鸡腿肉去骨切块，香菇切片；加姜丝和少量盐拌匀；上锅蒸至鸡肉完全熟透。'],
  ['清蒸鲈鱼', 'meat', '鲈鱼:180:g,姜:5:g,葱:5:g', '鱼', '鲈鱼去鳞内脏洗净；铺姜葱蒸至鱼肉熟透；去除鱼刺后分餐，按口味调味。'],
  ['西兰花炒鸡丁', 'meat', '鸡胸肉:130:g,西兰花:100:g,胡萝卜:40:g', '鸡肉', '食材切块，西兰花焯水；鸡丁炒至全熟；加入蔬菜翻炒调味。'],
  ['土豆炖牛肉', 'meat', '牛肉:130:g,土豆:120:g,胡萝卜:50:g', '牛肉', '牛肉焯水；加水炖软；加入土豆和胡萝卜继续炖至全熟。'],
  ['山药蒸肉饼', 'meat', '猪肉:130:g,山药:100:g', '猪肉', '山药去皮切碎；与肉末拌匀摊成肉饼；蒸至中心完全熟透。'],
  ['彩椒牛肉丝', 'meat', '牛肉:140:g,彩椒:100:g', '牛肉', '牛肉和彩椒切丝；牛肉炒至全熟；加入彩椒炒软，少量调味。'],
  ['虾仁炒蛋', 'meat', '虾仁:100:g,鸡蛋:1:个,葱:5:g', '虾,鸡蛋', '虾仁去虾线；蛋液打散；先炒熟虾仁，再加蛋液炒至凝固熟透。'],
  ['冬瓜炖排骨', 'meat', '排骨:160:g,冬瓜:150:g,姜:5:g', '猪肉', '排骨焯水洗净；加姜片炖煮；放入冬瓜炖软，去骨后分给孩子。'],
  ['香煎三文鱼', 'meat', '三文鱼:150:g,柠檬:10:g', '鱼', '鱼肉去刺擦干；少油小火煎两面；确认中心熟透后加柠檬汁。'],
  ['萝卜焖鸭', 'meat', '鸭肉:150:g,白萝卜:150:g,姜:5:g', '鸭肉', '鸭肉焯水；与萝卜姜片加水焖煮；煮至鸭肉软烂熟透。'],
  ['锅包肉', 'meat', '猪里脊:150:g,淀粉:30:g,胡萝卜:30:g', '猪肉', '里脊切片裹淀粉糊；炸至肉片全熟；锅内调糖醋汁，加入肉片翻匀。', 'rich'],
  ['清炒西兰花', 'vegetable', '西兰花:180:g,蒜:5:g', '', '西兰花切小朵洗净；焯水后沥干；少油加蒜翻炒至熟。'],
  ['蒜蓉菠菜', 'vegetable', '菠菜:200:g,蒜:5:g', '', '菠菜洗净焯水；沥干后与蒜末翻炒；按口味少量调味。'],
  ['香菇青菜', 'vegetable', '青菜:150:g,香菇:60:g', '', '青菜和香菇洗净；香菇先炒软；加入青菜炒熟。'],
  ['清蒸南瓜', 'vegetable', '南瓜:200:g', '', '南瓜去瓤切块；放入蒸锅；蒸至软熟即可。'],
  ['胡萝卜炒莴笋', 'vegetable', '莴笋:140:g,胡萝卜:60:g', '', '蔬菜洗净去皮切丝；少油下锅翻炒；炒熟后调味。'],
  ['白菜炖豆腐', 'vegetable', '白菜:140:g,豆腐:100:g', '大豆', '白菜切块，豆腐切片；加少量水炖煮；煮熟后调味。'],
  ['清炒荷兰豆', 'vegetable', '荷兰豆:180:g,蒜:5:g', '', '荷兰豆摘筋洗净；焯水；下锅翻炒至完全熟透。'],
  ['蚝油生菜', 'vegetable', '生菜:200:g,蚝油:5:g', '贝类', '生菜洗净焯熟；少量蚝油加水煮开；淋在生菜上。'],
  ['醋溜土豆丝', 'vegetable', '土豆:180:g,醋:5:ml', '', '土豆切丝冲洗；少油翻炒；加醋炒至全熟。'],
  ['口蘑炒芦笋', 'vegetable', '口蘑:100:g,芦笋:100:g', '', '食材洗净切段；口蘑炒软；加入芦笋炒熟。'],
  ['番茄炒蛋', 'vegetable', '番茄:150:g,鸡蛋:1:个', '鸡蛋', '鸡蛋炒至凝固盛出；番茄炒软；倒回鸡蛋翻匀至熟。'],
  ['清炒茭白', 'vegetable', '茭白:180:g,胡萝卜:30:g', '', '茭白和胡萝卜洗净切片；少油翻炒；加少量水焖至熟。'],
  ['米饭', 'staple', '大米:75:g', '', '大米淘洗；按电饭煲刻度加水；选择煮饭模式煮熟。'],
  ['小米饭', 'staple', '小米:40:g,大米:35:g', '', '小米与大米淘洗；加适量水；用电饭煲煮熟。'],
  ['糙米饭', 'staple', '糙米:40:g,大米:35:g', '', '糙米提前浸泡；与大米一起淘洗；加水煮至软熟。'],
  ['玉米饭', 'staple', '玉米粒:60:g,大米:60:g', '', '大米淘洗；加入玉米粒和水；煮熟后拌匀。'],
  ['红薯饭', 'staple', '红薯:100:g,大米:50:g', '', '红薯去皮切块；放在淘洗好的大米上；加水煮熟。'],
  ['南瓜饭', 'staple', '南瓜:100:g,大米:50:g', '', '南瓜切块；与淘洗好的大米一起加水；煮至软熟。'],
  ['荞麦面', 'staple', '荞麦面:80:g', '小麦', '烧开水；下荞麦面煮至熟透；捞出配餐。'],
  ['清汤面', 'staple', '面条:80:g,青菜:30:g', '小麦', '烧开水；下面条煮熟；加入青菜煮熟调味。'],
  ['紫米饭', 'staple', '紫米:30:g,大米:45:g', '', '紫米提前浸泡；与大米一起淘洗；加水煮至软熟。'],
  ['山药饭', 'staple', '山药:100:g,大米:50:g', '', '山药去皮切块；与大米一起加水；用电饭煲煮熟。'],
  ['冬瓜香菇汤', 'soup', '冬瓜:150:g,香菇:50:g', '', '冬瓜与香菇切片；加水煮熟；少量调味。'],
  ['番茄蛋汤', 'soup', '番茄:100:g,鸡蛋:0.5:个', '鸡蛋', '番茄加水煮软；倒入蛋液；煮至全熟。'],
  ['紫菜豆腐汤', 'soup', '紫菜:5:g,豆腐:100:g', '大豆', '豆腐切块；与紫菜加水煮；煮熟调味。'],
  ['玉米胡萝卜汤', 'soup', '玉米:100:g,胡萝卜:100:g', '', '蔬菜切块；加水煮开；小火煮至软熟。'],
  ['全麦面包', 'breakfast_staple', '全麦面包:80:g', '小麦', '选用配料明确的全麦面包；按需加热；切成适口大小。', '', true],
  ['小米粥', 'breakfast_staple', '小米:40:g', '', '小米淘洗；加足量水；小火煮至软烂。'],
  ['蒸红薯', 'breakfast_staple', '红薯:180:g', '', '红薯洗净切块；放入蒸锅；蒸至熟软。'],
  ['燕麦粥', 'breakfast_staple', '燕麦:45:g', '', '燕麦加水；小火煮熟；按口味调节稠度。'],
  ['玉米馒头', 'breakfast_staple', '玉米馒头:100:g', '小麦', '馒头放入蒸锅；水开后蒸至透热；放凉至适口温度。'],
  ['南瓜粥', 'breakfast_staple', '南瓜:80:g,大米:35:g', '', '南瓜切块，大米淘洗；加水煮；煮至米粒软烂。'],
  ['山药粥', 'breakfast_staple', '山药:80:g,大米:35:g', '', '山药去皮切块；与大米加水；煮至软烂。'],
  ['水煮蛋', 'breakfast_protein', '鸡蛋:1:个', '鸡蛋', '鸡蛋冷水入锅；煮至蛋白蛋黄全熟；剥壳食用。', '', true],
  ['温牛奶', 'breakfast_protein', '牛奶:200:ml', '牛奶', '使用合格巴氏或灭菌奶；按包装说明储存；按需温热。', '', true],
  ['豆浆', 'breakfast_protein', '黄豆:25:g', '大豆', '黄豆浸泡洗净；用豆浆机充分煮熟；温度适口后饮用。'],
  ['蒸蛋羹', 'breakfast_protein', '鸡蛋:1:个', '鸡蛋', '蛋液加温水搅匀；过筛后盖好；蒸至蛋液完全凝固。'],
  ['无糖酸奶', 'breakfast_protein', '无糖酸奶:150:g', '牛奶', '核对配料和保质期；按包装冷藏；取出后直接食用。'],
];
export function seedRecipes() {
  return dishes.map((d, i) => ({ id: `r${String(i + 1).padStart(3, '0')}`, name: d[0], category: d[1], baseServings: 1,
    ingredients: d[2].split(',').map(x => { const [name, amount, unit] = x.split(':'); return { name, amount: +amount, unit }; }),
    allergens: d[3].split(',').filter(Boolean), steps: d[4].split('；'), tags: d[5] === 'rich' ? ['浓郁'] : ['家常', '清淡'],
    repeatExempt: !!d[6], status: 'confirmed', source: 'Demo 示例菜谱，主材按生重/包装量估算，调味料按口味另备', seasonal: '通用', demo: true }));
}
export function initialState() {
  const schedule = child => Array.from({ length: 7 }, (_, day) => ({ breakfast: true, lunch: !(child && day < 5), dinner: true }));
  return { revision: 0, members: [
    { id: 'mom', name: '妈妈', sex: '女', age: 32, portion: 1, likes: ['清淡'], dislikes: [], allergies: [], restrictions: [], profileTags: ['清淡', '均衡饮食'], avatar: '', diseaseNotes: '', spice: '微辣', schedule: schedule(false), color: 'peach' },
    { id: 'dad', name: '爸爸', sex: '男', age: 34, portion: 1.2, likes: ['牛肉'], dislikes: [], allergies: [], restrictions: [], profileTags: ['爱吃肉'], avatar: '', diseaseNotes: '', spice: '微辣', schedule: schedule(false), color: 'sage' },
    { id: 'child', name: '宝宝', sex: '女', age: 4, portion: 0.5, likes: ['南瓜'], dislikes: [], allergies: [], restrictions: [], profileTags: ['不吃辣'], avatar: '', diseaseNotes: '', spice: '不辣', schedule: schedule(true), color: 'yellow' }
  ], recipes: seedRecipes(), menus: {}, overrides: {}, imports: [], feedback: [], messages: [], proposals: [], undo: {}, documents: [], jobs: [],
    rules: { ...MENU_RULES, formal: false, nutrition: '早餐主食＋蛋白质，午晚餐五道菜另加主食；不计算精确热量。', quantityBasis: '每位成人参考份数；主材生重/包装量，调味料另备。' },
    settings: { timezone: 'Asia/Shanghai', scheduleTime: '20:00', scheduleEnabled: true }, agentLastRun: null };
}
