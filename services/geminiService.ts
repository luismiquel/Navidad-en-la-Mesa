
import { GoogleGenAI } from "@google/genai";
import { Recipe } from '../types';

/**
 * SERVICIO EXPERTO CULINARIO GEMINI
 * Proporciona respuestas contextuales basadas en la receta activa y el paso actual.
 */
export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string,
  servings: number = 4
): Promise<string> => {
  try {
    // Inicialización con la API Key del entorno
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const currentStep = recipe.steps[currentStepIndex];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: userQuery }] }],
      config: {
        systemInstruction: `Eres un Chef Estrella Michelin especializado en cenas de Navidad. 
        Estás guiando a un usuario en la receta: "${recipe.title}".
        Paso actual (${currentStepIndex + 1}/${recipe.steps.length}): "${currentStep?.description}".
        Comensales configurados: ${servings} (La receta base es para ${recipe.servingsBase}).

        REGLAS:
        1. Si el usuario pregunta por ingredientes o cantidades, calcula la proporción exacta (${servings}/${recipe.servingsBase}).
        2. Si pide sustitutos por alergia o falta de stock, ofrece alternativas gourmet.
        3. Si pregunta por técnicas (ej. "punto de nieve", "sofreír"), explica brevemente cómo hacerlo.
        4. Responde siempre en español, con calidez festiva y máximo 2-3 frases.`,
      },
    });

    // Acceso a la propiedad .text según el SDK
    return response.text || "No he podido procesar tu duda. ¿Puedes preguntarme de otra forma?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lo siento, mi conexión con la cocina central se ha interrumpido. ¡Sigue adelante, vas muy bien!";
  }
};
