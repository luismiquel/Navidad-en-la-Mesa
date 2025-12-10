// Definimos Category como Enum para usar Category.APERITIVO, etc.
export enum Category {
  APERITIVO = 'Aperitivos',
  PRIMERO = 'Primeros',
  SEGUNDO = 'Segundos',
  POSTRE = 'Postres'
}

// Definimos Difficulty como Enum
export enum Difficulty {
  FACIL = 'Fácil',
  MEDIA = 'Media',
  DIFICIL = 'Difícil'
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category?: string; // Opcional, por si en el futuro quieres agrupar la lista de compra
}

export interface Step {
  order: number;
  description: string;
  timerMinutes?: number; // Opcional
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  category: Category;
  imageUrl: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  difficulty: Difficulty;
  servingsBase: number;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
}

export interface AppSettings {
  highContrast: boolean;
  fontSizeMultiplier: number;
  voiceEnabled: boolean;
}

export type ViewState = 
  | { type: 'HOME' }
  | { type: 'CATEGORY'; category: Category }
  | { type: 'RECIPE'; recipeId: string }
  | { type: 'COOKING'; recipeId: string }
  | { type: 'CART' }
  | { type: 'SETTINGS' };

export type AppStatus = 'idle' | 'listening' | 'speaking' | 'processing';
