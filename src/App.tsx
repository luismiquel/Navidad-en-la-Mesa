
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Category, Recipe, ViewState, AppSettings, Ingredient, AppStatus, CookingProgress } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { 
  Mic, ChevronLeft, ChevronRight, Clock, Play, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, 
  Plus, Trash2, X, Search, CheckCircle2, Users, Timer, Info, Sparkles
} from 'lucide-react';

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [settings, setSettings] = useState<AppSettings>({
    highContrast: false,
    fontSizeMultiplier: 1,
    voiceEnabled: true,
  });

  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(4);
  const [cart, setCart] = useState<Ingredient[]>(() => {
      const saved = localStorage.getItem('christmas_cart');
      return saved ? JSON.parse(saved) : [];
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [maxTime, setMaxTime] = useState<number>(180);

  const [currentStep, setCurrentStep] = useState(0);
  const [preppedIngredients, setPreppedIngredients] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<AppStatus>('idle');

  // Recuperar progreso de cocina
  useEffect(() => {
    const savedProgress = localStorage.getItem('cooking_progress');
    if (savedProgress) {
      const progress: CookingProgress = JSON.parse(savedProgress);
      // Opcional: preguntar al usuario si quiere retomar
    }
  }, []);

  useEffect(() => {
    if (view.type === 'COOKING' && activeRecipe) {
      const progress: CookingProgress = {
        recipeId: activeRecipe.id,
        currentStep,
        preppedIngredients: Object.keys(preppedIngredients).filter(k => preppedIngredients[k]),
        startTime: Date.now()
      };
      localStorage.setItem('cooking_progress', JSON.stringify(progress));
    }
  }, [currentStep, preppedIngredients, view, activeRecipe]);

  useEffect(() => { localStorage.setItem('christmas_cart', JSON.stringify(cart)); }, [cart]);

  const speakRobust = useCallback((text: string, onEnd?: () => void) => {
    if (!settings.voiceEnabled) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0; 
    utterance.onend = () => { setStatus('idle'); onEnd?.(); };
    setStatus('speaking');
    window.speechSynthesis.speak(utterance);
  }, [settings.voiceEnabled]);

  const startListening = () => {
    if (!SpeechRecognition) return;
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.onstart = () => setStatus('listening');
        recognition.onend = () => { if (status === 'listening') setStatus('idle'); };
        recognition.onresult = (e: any) => handleVoiceCommand(e.results[0][0].transcript.toLowerCase());
        recognition.start();
    } catch (e) { setStatus('idle'); }
  };

  const handleVoiceCommand = (command: string) => {
      if (command.includes('siguiente')) {
          if (activeRecipe && currentStep < activeRecipe.steps.length - 1) setCurrentStep(prev => prev + 1);
      } else if (command.includes('anterior')) {
          if (currentStep > 0) setCurrentStep(prev => prev - 1);
      } else if (command.includes('repite')) {
          speakRobust(activeRecipe?.steps[currentStep].description || "");
      } else {
          askLocalAssistant(command);
      }
  };

  const askLocalAssistant = async (query: string) => {
      if (!activeRecipe) return;
      setStatus('processing');
      const text = await generateCookingAssistance(activeRecipe, currentStep, query, servings);
      speakRobust(text);
  };

  const filteredRecipes = useMemo(() => {
    return SAMPLE_RECIPES.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.tags.some(t => t.includes(searchTerm.toLowerCase()));
      const matchesTag = activeFilter ? r.tags.includes(activeFilter) : true;
      const matchesTime = (r.prepTimeMinutes + r.cookTimeMinutes) <= maxTime;
      return matchesSearch && matchesTag && matchesTime;
    });
  }, [searchTerm, activeFilter, maxTime]);

  const getFinishTime = () => {
    if (!activeRecipe) return "";
    const totalMinutes = activeRecipe.cookTimeMinutes + activeRecipe.prepTimeMinutes;
    const date = new Date();
    date.setMinutes(date.getMinutes() + totalMinutes);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- STYLES ---
  const bgColor = settings.highContrast ? 'bg-black' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const cardBg = settings.highContrast ? 'bg-gray-900 border-gray-700' : 'bg-white border-christmas-gold/20';

  if (showIntro) {
      return (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
              <div className="relative">
                <ChefHat size={100} className="mb-6 animate-pulse text-christmas-accent" />
                <Sparkles className="absolute -top-2 -right-2 text-white animate-spin-slow" />
              </div>
              <h1 className="text-6xl font-serif font-bold mb-4 tracking-tighter">Navidad en la Mesa</h1>
              <p className="text-xl mb-12 opacity-80 max-w-md font-light italic">Tu cocina, bajo control total y offline.</p>
              <button onClick={() => { setShowIntro(false); speakRobust("Hola, ¿listo para cocinar?"); }} className="px-16 py-6 text-2xl font-bold rounded-2xl shadow-2xl bg-christmas-green text-white hover:scale-105 transition-transform border-b-8 border-green-900">Empezar ahora</button>
          </div>
      );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-colors duration-500`}>
        {/* HEADER MEJORADO */}
        <header className={`p-4 flex justify-between items-center shadow-lg sticky top-0 z-40 ${settings.highContrast ? 'bg-gray-900' : 'bg-christmas-red text-white'}`}>
            <div onClick={() => setView({type: 'HOME'})} className="flex items-center gap-3 cursor-pointer group">
                <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors"><ChefHat size={24}/></div>
                <span className="font-serif font-bold text-2xl tracking-tight hidden sm:inline">Navidad en la Mesa</span>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setView({type: 'CART'})} className="p-3 rounded-xl hover:bg-white/10 relative transition-colors"><ShoppingCart size={24}/>{cart.length > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-christmas-accent text-black text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-christmas-red">{cart.length}</span>}</button>
                <button onClick={() => setView({type: 'SETTINGS'})} className="p-3 rounded-xl hover:bg-white/10 transition-colors"><SettingsIcon size={24}/></button>
            </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-40">
            
            {/* HOME CON FILTROS AVANZADOS */}
            {(view.type === 'HOME' || view.type === 'CATEGORY') && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-christmas-gold" size={20} />
                            <input 
                                type="text"
                                placeholder="Busca ingredientes o platos..."
                                className={`w-full pl-12 pr-4 py-5 rounded-2xl border-2 focus:ring-4 focus:ring-christmas-accent outline-none transition-all text-lg shadow-sm ${cardBg}`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className={`flex items-center gap-3 p-2 rounded-2xl border-2 ${cardBg} whitespace-nowrap`}>
                          <Clock size={18} className="text-christmas-gold ml-2" />
                          <span className="text-sm font-bold">Máx {maxTime} min</span>
                          <input type="range" min="15" max="180" step="15" value={maxTime} onChange={(e) => setMaxTime(parseInt(e.target.value))} className="accent-christmas-red cursor-pointer" />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                        {['tradicional', 'vegano', 'marisco', 'rápido', 'sin gluten', 'niños'].map(tag => (
                            <button 
                                key={tag}
                                onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                                className={`px-6 py-2 rounded-xl text-sm font-bold uppercase transition-all border-2
                                    ${activeFilter === tag ? 'bg-christmas-red border-christmas-red text-white' : 'bg-white border-christmas-gold/30 text-christmas-gold'}`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {!searchTerm && view.type === 'HOME' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.values(Category).map(cat => (
                                <button key={cat} onClick={() => setView({type: 'CATEGORY', category: cat})} className={`p-6 text-center rounded-2xl border-2 hover:border-christmas-red transition-all group ${cardBg}`}>
                                    <h3 className="font-serif font-bold text-lg group-hover:text-christmas-red">{cat}</h3>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredRecipes.filter(r => view.type === 'CATEGORY' ? r.category === view.category : true).map(recipe => (
                            <div key={recipe.id} onClick={() => { setActiveRecipe(recipe); setView({type: 'RECIPE', recipeId: recipe.id}); }} className={`rounded-3xl overflow-hidden border-2 cursor-pointer transition-all hover:-translate-y-2 hover:shadow-2xl flex flex-col h-full ${cardBg}`}>
                                <div className="h-48 relative overflow-hidden">
                                  <img src={recipe.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                  <div className="absolute top-3 left-3 flex gap-1">
                                    {recipe.tags.slice(0, 2).map(t => <span key={t} className="bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-lg font-bold uppercase">{t}</span>)}
                                  </div>
                                </div>
                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                      <h3 className="font-bold font-serif text-xl mb-2 leading-tight">{recipe.title}</h3>
                                      <div className="flex items-center gap-4 text-xs opacity-60 font-bold">
                                        <span className="flex items-center gap-1"><Clock size={14}/> {recipe.cookTimeMinutes + recipe.prepTimeMinutes} min</span>
                                        <span className="flex items-center gap-1"><Info size={14}/> {recipe.difficulty}</span>
                                      </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VISTA RECETA CON ESCALADO */}
            {view.type === 'RECIPE' && activeRecipe && (
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold opacity-60 hover:opacity-100 transition-opacity"><ChevronLeft /> Atrás</button>
                    
                    <div className={`rounded-[2.5rem] overflow-hidden shadow-2xl ${cardBg}`}>
                        <div className="h-80 relative">
                          <img src={activeRecipe.imageUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-8">
                            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white leading-none">{activeRecipe.title}</h1>
                          </div>
                        </div>

                        <div className="p-8 space-y-10">
                            {/* Control de comensales */}
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-christmas-gold/5 p-6 rounded-3xl border border-christmas-gold/20">
                                <div>
                                  <h4 className="font-bold flex items-center gap-2"><Users size={20}/> Comensales</h4>
                                  <p className="text-sm opacity-60">Ajustaremos las cantidades por ti.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <button onClick={() => setServings(Math.max(1, servings - 1))} className="w-12 h-12 rounded-full bg-white border-2 border-christmas-gold flex items-center justify-center font-bold text-2xl hover:bg-christmas-gold hover:text-white transition-colors">-</button>
                                  <span className="text-3xl font-black min-w-[1.5rem] text-center">{servings}</span>
                                  <button onClick={() => setServings(servings + 1)} className="w-12 h-12 rounded-full bg-white border-2 border-christmas-gold flex items-center justify-center font-bold text-2xl hover:bg-christmas-gold hover:text-white transition-colors">+</button>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-12">
                                <section>
                                    <h3 className="text-2xl font-serif font-bold mb-6 border-b-4 border-christmas-red inline-block">Ingredientes</h3>
                                    <ul className="space-y-4">
                                        {activeRecipe.ingredients.map((ing, i) => (
                                            <li key={i} onClick={() => setPreppedIngredients({...preppedIngredients, [ing.name]: !preppedIngredients[ing.name]})} className="flex items-center justify-between group cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                  <div className={`w-6 h-6 rounded-md border-2 transition-colors ${preppedIngredients[ing.name] ? 'bg-christmas-green border-christmas-green' : 'border-christmas-gold/30 group-hover:border-christmas-gold'}`}>
                                                    {preppedIngredients[ing.name] && <CheckCircle2 size={16} className="text-white mx-auto mt-0.5" />}
                                                  </div>
                                                  <span className={`text-lg transition-all ${preppedIngredients[ing.name] ? 'line-through opacity-40' : ''}`}>{ing.name}</span>
                                                </div>
                                                <span className="font-bold text-christmas-red">{(ing.amount * (servings / activeRecipe.servingsBase)).toFixed(1).replace('.0', '')} {ing.unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section className="space-y-6">
                                    <div className="bg-christmas-red/5 p-6 rounded-3xl space-y-4 border border-christmas-red/10">
                                      <h3 className="font-bold flex items-center gap-2 text-christmas-red"><Timer size={20}/> Tiempos del Chef</h3>
                                      <div className="space-y-2">
                                        <div className="flex justify-between"><span>Preparación:</span> <b>{activeRecipe.prepTimeMinutes} min</b></div>
                                        <div className="flex justify-between"><span>Cocción:</span> <b>{activeRecipe.cookTimeMinutes} min</b></div>
                                        <div className="flex justify-between border-t pt-2 mt-2"><span>Estará listo a las:</span> <b className="text-christmas-red">{getFinishTime()}</b></div>
                                      </div>
                                    </div>
                                    <button onClick={() => { setView({type: 'COOKING', recipeId: activeRecipe.id}); setCurrentStep(0); speakRobust(`Comenzamos. ${activeRecipe.steps[0].description}`); }} className="w-full py-6 text-2xl font-bold rounded-2xl bg-christmas-green text-white shadow-xl hover:shadow-christmas-green/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                                      <Play fill="white"/> Modo Cocina
                                    </button>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODO COCINA CON ASISTENTE REFORZADO */}
            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col gap-6 max-w-2xl mx-auto h-[60vh] justify-center text-center">
                    <div className="flex justify-between items-center mb-8">
                        <span className="px-4 py-1 rounded-full bg-christmas-gold/20 text-christmas-gold font-bold text-sm">Paso {currentStep + 1} de {activeRecipe.steps.length}</span>
                        <div className="flex items-center gap-2 font-bold text-sm opacity-60"><Users size={16}/> {servings} pers.</div>
                    </div>

                    <div className={`p-10 md:p-16 rounded-[3rem] border-8 shadow-2xl relative transition-all duration-500
                        ${settings.highContrast ? 'bg-black border-christmas-accent text-white' : 'bg-white border-christmas-green'}`}>
                        <p className="text-3xl md:text-5xl font-serif font-bold leading-tight animate-in fade-in slide-in-from-top-4">
                            {activeRecipe.steps[currentStep].description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} className="p-6 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 hover:bg-black/5 transition-colors disabled:opacity-20"><ChevronLeft /> Anterior</button>
                        <button disabled={currentStep === activeRecipe.steps.length - 1} onClick={() => setCurrentStep(prev => prev + 1)} className="p-6 rounded-2xl bg-christmas-green text-white font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-20">Siguiente <ChevronRight /></button>
                    </div>

                    {/* Barra de Voz Fija */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-christmas-cream via-christmas-cream to-transparent">
                      <button 
                        onClick={() => status === 'listening' ? null : startListening()}
                        className={`w-full max-w-lg mx-auto py-10 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all border-4
                        ${status === 'listening' ? 'bg-christmas-accent animate-pulse border-white' : 'bg-christmas-red text-white border-christmas-gold'}`}
                      >
                          <Mic size={status === 'listening' ? 56 : 40} />
                          <span className="text-2xl font-black mt-2 tracking-tighter uppercase">{status === 'listening' ? 'Pregunta cantidades...' : 'Toca para hablar'}</span>
                      </button>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
}
