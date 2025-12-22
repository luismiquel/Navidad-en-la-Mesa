
import { Recipe } from '../types';

/**
 * MOTOR DE CONOCIMIENTO LOCAL CULINARIO
 * Sin IA, sin APIs, solo lógica determinista de alto rendimiento.
 */

const SUBSTITUTIONS: Record<string, string> = {
  'mantequilla': 'aceite de oliva (80% de la cantidad), margarina o puré de manzana para repostería.',
  'huevo': 'una cucharada de semillas de lino con agua, medio plátano machacado o puré de manzana.',
  'leche': 'bebida de soja, avena o simplemente agua con un poco de mantequilla.',
  'vino': 'caldo de pollo o verduras con un chorrito de vinagre o zumo de uva.',
  'harina': 'harina de avena triturada, harina de arroz o maicena (para espesar).',
  'nata': 'leche evaporada, yogur griego natural o crema de coco.',
  'azúcar': 'miel, sirope de arce, estevia o dátiles triturados.',
  'cilantro': 'perejil fresco con un toque de lima.',
};

export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string,
  servings: number = 4
): Promise<string> => {
  const query = userQuery.toLowerCase().trim();
  const currentStep = recipe.steps[currentStepIndex];
  const ratio = servings / recipe.servingsBase;
  
  // 1. Detección de Sustituciones
  for (const [key, value] of Object.entries(SUBSTITUTIONS)) {
    if (query.includes(key) && (query.includes('no tengo') || query.includes('sustituir') || query.includes('cambiar'))) {
      return `Si no tienes ${key}, puedes usar ${value}`;
    }
  }

  // 2. Cálculos de Cantidades Escaladas e Inteligentes
  if (/\b(cuanto|cantidad|proporcion|gramos|mucho)\b/i.test(query)) {
    const ingredient = recipe.ingredients.find(i => query.includes(i.name.toLowerCase().split(' ')[0]));
    if (ingredient) {
      const amount = ingredient.amount * ratio;
      let displayAmount = amount.toFixed(1).replace('.0', '');
      let unit = ingredient.unit;

      // Conversión inteligente de unidades
      if (unit === 'g' && amount >= 1000) { displayAmount = (amount / 1000).toFixed(2); unit = 'kg'; }
      if (unit === 'ml' && amount >= 1000) { displayAmount = (amount / 1000).toFixed(2); unit = 'litros'; }

      return `Para ${servings} personas necesitas ${displayAmount} ${unit} de ${ingredient.name}.`;
    }
  }

  // 3. Resumen de Ingredientes para el Paso
  if (/\b(necesito|que uso|ingredientes)\b/i.test(query)) {
    return `Para este paso estamos usando ${recipe.ingredients.slice(0, 3).map(i => i.name).join(', ')}. ¿Quieres saber las cantidades exactas?`;
  }

  // 4. Guía de Tiempos
  if (/\b(tiempo|falta|minuto|reloj|cuando)\b/i.test(query)) {
    const stepTime = currentStep?.timerMinutes;
    return stepTime 
      ? `Este paso requiere unos ${stepTime} minutos. ¡No pierdas de vista el reloj!`
      : `Este paso no tiene un tiempo fijo, guíate por la textura o el color. La receta total son ${recipe.cookTimeMinutes} minutos.`;
  }

  // 5. Soporte de Dificultad
  if (/\b(dificil|complicado|ayuda|consejo)\b/i.test(query)) {
    return `Esta receta es de dificultad ${recipe.difficulty.toLowerCase()}. Mi consejo: lee el siguiente paso antes de terminar este para ir por delante.`;
  }

  // Fallback Contextual
  return `Estamos en el paso ${currentStepIndex + 1} de ${recipe.steps.length}. Dice: ${currentStep?.description.substring(0, 50)}... ¿Necesitas saber algún ingrediente o pasamos al siguiente?`;
};
