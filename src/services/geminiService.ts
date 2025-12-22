
import { GoogleGenAI } from "@google/genai";
import { Recipe } from '../types';

/**
 * MOTOR DE CONOCIMIENTO CULINARIO GEMINI
 * Implementación profesional utilizando la SDK de Google GenAI para asistencia contextual.
 */
export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string,
  servings: number = 4
): Promise<string> => {
  try {
    // Inicialización de instancia por solicitud para manejar contextos dinámicos de API
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const currentStep = recipe.steps[currentStepIndex];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Consulta del usuario: ${userQuery}`,
      config: {
        systemInstruction: `Eres un asistente de cocina experto. Estás guiando al usuario en la receta "${recipe.title}". 
        Paso actual (${currentStepIndex + 1}/${recipe.steps.length}): "${currentStep?.description}".
        Configuración de comensales: ${servings} (Base de receta: ${recipe.servingsBase}).
        
        Instrucciones:
        1. Si piden sustitutos, ofrece opciones comunes en la cocina tradicional y moderna.
        2. Si piden cantidades, calcula la proporción (${servings}/${recipe.servingsBase}) sobre los ingredientes originales de la receta.
        3. Si piden consejos o trucos técnicos, sé preciso y alentador.
        4. Responde siempre en español y de forma breve (máximo 3 frases).`,
      },
    });

    // Extracción de texto usando la propiedad .text del SDK
    return response.text || "No he podido encontrar una respuesta clara. ¿Podrías reformular tu pregunta?";
  } catch (error) {
    console.error("Gemini Assistant Error:", error);
    return "Parece que el asistente de cocina se ha tomado un descanso navideño. Por favor, inténtalo de nuevo en un momento.";
  }
};
