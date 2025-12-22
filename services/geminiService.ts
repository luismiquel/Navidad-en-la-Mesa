
import { GoogleGenAI } from "@google/genai";
import { Recipe } from '../types';

/**
 * MOTOR DE ASISTENCIA CULINARIA GEMINI
 * Este servicio utiliza la API de Gemini para proporcionar ayuda experta en tiempo real.
 */
export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string,
  servings: number = 4
): Promise<string> => {
  try {
    // Inicialización según las guías: nueva instancia por llamada para usar la clave más actualizada
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const step = recipe.steps[currentStepIndex];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userQuery,
      config: {
        systemInstruction: `Eres un chef experto y asistente de cocina para Navidad. Estás ayudando con la receta "${recipe.title}". 
        El usuario está actualmente en el paso ${currentStepIndex + 1}: "${step.description}".
        Están cocinando para ${servings} personas (la receta base es para ${recipe.servingsBase}).
        Ayuda al usuario con dudas sobre ingredientes, sustitutos y técnica culinaria. 
        Si preguntan por cantidades, escala los ingredientes basándote en que la receta es para ${recipe.servingsBase} y ellos son ${servings}.
        Responde en español de forma concisa, útil y con un tono cálido y festivo.`,
      },
    });

    // Acceso a .text como propiedad según las guías de @google/genai
    return response.text || "Lo siento, no he podido procesar tu duda. ¡Prueba a preguntarme de otra forma!";
  } catch (error) {
    console.error("Gemini Assistance Error:", error);
    return "Lo siento, el asistente de cocina está teniendo problemas de conexión. Por favor, intenta de nuevo en unos momentos.";
  }
};
