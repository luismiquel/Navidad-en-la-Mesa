
import { GoogleGenAI } from "@google/genai";
import { Recipe } from '../types';

/**
 * Motor de asistencia culinaria utilizando la API de Gemini para respuestas inteligentes y naturales.
 */
export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string
): Promise<string> => {
  // Inicialización del cliente de IA utilizando la clave de API del entorno.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const currentStep = recipe.steps[currentStepIndex];

  // Construcción del prompt de sistema para guiar al modelo.
  const prompt = `
    Eres un asistente de cocina amable y festivo para la aplicación "Navidad en la Mesa".
    Tu tarea es ayudar al usuario a preparar la receta: "${recipe.title}".
    
    Información relevante:
    - Paso actual de la receta (${currentStepIndex + 1} de ${recipe.steps.length}): "${currentStep?.description || 'Receta finalizada'}"
    - Lista de ingredientes necesarios: ${recipe.ingredients.map(i => `${i.amount} ${i.unit} de ${i.name}`).join(', ')}
    
    Pregunta o instrucción del usuario: "${userQuery}"
    
    Reglas de respuesta:
    1. Sé breve y conciso (máximo 30 palabras).
    2. Responde en un tono cálido y navideño.
    3. No utilices formato Markdown (sin asteriscos, negritas ni listas).
    4. Céntrate exclusivamente en ayudar con la receta actual.
  `;

  try {
    // Generación de contenido con el modelo Gemini 3 Flash, ideal para respuestas rápidas y precisas.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Acceso a la propiedad .text para obtener la respuesta generada.
    const text = response.text;
    
    return text || "Lo siento, no he podido procesar tu duda en este momento.";
  } catch (error) {
    console.error("Error al conectar con la API de Gemini:", error);
    
    // Fallback contextual en caso de error de conexión.
    const lowerQuery = userQuery.toLowerCase();
    if (lowerQuery.includes("ingrediente")) {
        return `Para esta receta necesitas varios ingredientes como ${recipe.ingredients[0].name}. ¿Quieres que te repita el paso actual?`;
    }
    
    return "En este momento no puedo hablar con el gran chef, pero te recuerdo que estamos en el paso: " + (currentStep?.description || "final");
  }
};
