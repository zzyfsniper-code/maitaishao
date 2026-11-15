import { addDays, monday } from './seed.mjs';

export const POSITIVE_RULE_VERSION = 'positive-v1';
const seasoning = new Set(['盐', '食盐', '白糖', '糖', '冰糖', '油', '食用油', '植物油', '菜籽油', '橄榄油', '芝麻油', '香油', '酱油', '生抽', '老抽', '醋', '米醋', '料酒', '蚝油', '味精', '鸡精', '胡椒粉', '水', '清水', '淀粉', '玉米淀粉', '姜', '生姜', '大蒜', '蒜', '葱', '小葱']);
export function foodNames(recipe) {
  return [...new Set((recipe?.ingredients || []).map(i => i.name.trim().replaceAll('西红柿', '番茄').replaceAll('虾仁', '虾').replaceAll('花生仁', '花生')).filter(n => n && !seasoning.has(n)))];
}
export function diversityBonus(recipe, members, prior, date) {
  if (!members.length) return 0;
  const week = monday(date), end = addDays(week, 6), names = foodNames(recipe);
  return members.reduce((sum, member) => {
    const known = new Set(prior.filter(m => m.date >= week && m.date <= end && m.memberIds.includes(member.id)).flatMap(m => m.dishes.flatMap(d => foodNames(m._recipes?.[d.recipeId]))));
    return sum + names.filter(name => !known.has(name)).length;
  }, 0) / members.length;
}
export function nutritionSummary(state, week) {
  const meals = state.menus[week]?.meals || [], recipes = Object.fromEntries(state.recipes.map(r => [r.id, r]));
  const namesFor = selected => [...new Set(selected.flatMap(m => m.dishes.flatMap(d => foodNames(recipes[d.recipeId]))))];
  return { version: POSITIVE_RULE_VERSION, scope: '仅已安排的家庭餐次，不代表实际摄入或完整全天饮食',
    foodCount: namesFor(meals).length,
    members: state.members.map(m => ({ memberId: m.id, foodCount: namesFor(meals.filter(meal => meal.memberIds.includes(m.id))).length })),
    nutrients: { status: 'unavailable', label: '暂不评价', reason: '缺少完整食材成分、调味料用量和个人实际摄入记录。' } };
}
