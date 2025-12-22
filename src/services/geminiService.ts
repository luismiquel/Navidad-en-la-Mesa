
import { Recipe } from '../types';

/**
 * MOTOR DE LÓGICA LOCAL PRO (V2)
 * Sin dependencias externas. 100% Offline.
 */

export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string,
  servings: number = 4
): Promise<string> => {
  const query = userQuery.toLowerCase().trim();
  const currentStep = recipe.steps[currentStepIndex];
  const ratio = servings / recipe.servingsBase;
  
  // 1. Lógica de Cantidades Escaladas
  if (/\b(cuanto|cantidad|proporcion|gramos|mucho)\b/i.test(query)) {
    const ingredient = recipe.ingredients.find(i => query.includes(i.name.toLowerCase().split(' ')[0]));
    if (ingredient) {
      const scaledAmount = (ingredient.amount * ratio).toFixed(1).replace('.0', '');
      return `Para ${servings} personas necesitas ${scaledAmount} ${ingredient.unit} de ${ingredient.name}.`;
    }
  }

  // 2. Lógica de Ingredientes Totales
  if (/\b(ingredientes|que lleva|lista|necesito)\b/i.test(query)) {
    const list = recipe.ingredients.map(i => i.name).slice(0, 5).join(', ');
    return `Lleva ${list} y otros. ¿Quieres que te diga las cantidades para ${servings} personas?`;
  }

  // 3. Lógica de Tiempo y Finalización
  if (/\b(tiempo|cuanto falta|terminar|minutos|hora)\b/i.test(query)) {
    const totalRem = recipe.cookTimeMinutes; 
    return `Este paso dura unos ${currentStep.timerMinutes || 'unos'} minutos. La receta completa son ${recipe.cookTimeMinutes} minutos en total.`;
  }

  // 4. Lógica de Pasos
  if (/\b(repite|paso|que hago|entiendo|ayuda)\b/i.test(query)) {
    return `Estamos en el paso ${currentStepIndex + 1}. Tienes que: ${currentStep.description}. ¡Vas muy bien!`;
  }

  // 5. Lógica de Sugerencias (Local)
  if (/\b(sugerencia|recomend|otro plato|consejo)\b/i.test(query)) {
    return `Mi consejo: Prepara todos los ingredientes antes de encender el fuego. ¡La organización es clave en Navidad!`;
  }

  // Fallback
  return `Estoy aquí para ayudarte con el paso ${currentStepIndex + 1}. ¿Quieres saber las cantidades o que te repita la instrucción?`;
};
