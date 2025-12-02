
import { GoogleGenAI } from "@google/genai";
import { Recipe, Step } from '../types';

let genAI: GoogleGenAI | null = null;

const getAI = () => {
  if (!genAI && process.env.API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAI;
};

export const generateCookingAssistance = async (
  recipe: Recipe,
  currentStepIndex: number,
  userQuery: string
): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Lo siento, la clave de API no está configurada.";

  const currentStep = recipe.steps[currentStepIndex];
  
  const prompt = `
    Eres un asistente de cocina para la app "Navidad en la Mesa".
    Tu respuesta será LEÍDA EN VOZ ALTA por un sintetizador (TTS).
    
    REGLAS ESTRICTAS DE RESPUESTA:
    1. NO uses Markdown (nada de asteriscos **, guiones -, ni almohadillas #).
    2. Usa frases cortas y directas.
    3. Máximo 25 palabras.
    4. Sé amable pero conciso.
    5. NO hagas listas, usa oraciones fluidas.
    
    Contexto:
    - Receta: ${recipe.title}
    - Paso actual (${currentStepIndex + 1}): "${currentStep?.description || 'Finalizado'}"
    - Ingredientes: ${recipe.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join(', ')}
    
    Pregunta del usuario: "${userQuery}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    // Limpiamos cualquier rastro de markdown que pueda quedar
    return response.text?.replace(/[*#_`]/g, '').trim() || "No te he entendido bien.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Tengo problemas de conexión.";
  }
};
