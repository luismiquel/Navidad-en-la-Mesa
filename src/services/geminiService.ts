
import { Recipe } from '../types';

/**
 * Este servicio ya no utiliza IA en la nube (Google Gemini).
 * Ahora funciona de forma 100% local analizando los datos de la receta.
 * Ventajas: Coste $0, Privacidad Total, Funciona sin Internet, Latencia Cero.
 */

export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string
): Promise<string> => {
  const query = userQuery.toLowerCase();
  const currentStep = recipe.steps[currentStepIndex];
  
  // 1. Lógica para ingredientes
  if (query.includes('ingrediente') || query.includes('necesito') || query.includes('lleva') || query.includes('que hay que poner')) {
    const list = recipe.ingredients.map(i => i.name).join(', ');
    return `Para esta receta necesitas: ${list}. ¿Quieres que te repita alguno?`;
  }

  // 2. Lógica para tiempos y temporizador
  if (query.includes('tiempo') || query.includes('minutos') || query.includes('cuanto falta') || query.includes('duracion')) {
    if (currentStep?.timerMinutes) {
      return `Este paso requiere ${currentStep.timerMinutes} minutos. El tiempo total de cocción es de ${recipe.cookTimeMinutes} minutos.`;
    }
    return `Para toda la receta calculamos unos ${recipe.cookTimeMinutes} minutos de cocción.`;
  }

  // 3. Lógica para explicación de pasos
  if (query.includes('explicame') || query.includes('entiendo') || query.includes('como se hace') || query.includes('que hago')) {
    return `Estamos en el paso ${currentStepIndex + 1}. Lo que tienes que hacer es: ${currentStep.description}. Es sencillo, ¡tú puedes!`;
  }

  // 4. Lógica para cantidades específicas
  const ingredientFound = recipe.ingredients.find(i => query.includes(i.name.toLowerCase().split(' ')[0]));
  if (ingredientFound) {
    return `De ${ingredientFound.name} necesitas exactamente ${ingredientFound.amount} ${ingredientFound.unit}.`;
  }

  // 5. Lógica para ayuda general / errores
  if (query.includes('ayuda') || query.includes('hola') || query.includes('que puedes hacer')) {
    return `Puedo decirte los ingredientes, explicarte el paso actual o decirte cuánto tiempo falta. ¿Qué necesitas?`;
  }

  // Respuesta por defecto (Simula una respuesta inteligente pero local)
  return `Para ${recipe.title}, ahora estamos en el paso de ${currentStep.description.toLowerCase()}. ¿Te ayudo con los ingredientes o seguimos?`;
};
