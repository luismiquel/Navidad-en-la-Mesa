
export enum Category {
  APERITIVO = 'Aperitivos',
  PRIMERO = 'Primeros',
  SEGUNDO = 'Segundos',
  POSTRE = 'Postres'
}

export enum Difficulty {
  FACIL = 'Fácil',
  MEDIA = 'Media',
  DIFICIL = 'Difícil'
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string; // "g", "ml", "unidades", "cucharadas", "pizca"
  category?: string;
}

export interface Step {
  order: number;
  description: string;
  timerMinutes?: number;
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
  servingsBase: number; // Siempre 4 en esta especificación
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[]; // "vegano", "sin gluten", "navidad", "tradicional"
}

export interface AppSettings {
  highContrast: boolean;
  fontSizeMultiplier: number; // 1 (Normal), 1.25 (Grande), 1.5 (Muy grande)
  voiceEnabled: boolean;
}

export type ViewState = 
  | { type: 'HOME' }
  | { type: 'CATEGORY'; category: Category }
  | { type: 'RECIPE'; recipeId: string }
  | { type: 'COOKING'; recipeId: string }
  | { type: 'CART' }
  | { type: 'FAVORITES' }
  | { type: 'SETTINGS' };
