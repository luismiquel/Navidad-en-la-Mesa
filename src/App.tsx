
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Category, Recipe, ViewState, AppSettings, Ingredient, AppStatus } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { 
  Mic, ChevronLeft, ChevronRight, Clock, Play, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, 
  Plus, Trash2, X, Search, CheckCircle2, Filter
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
  const [cart, setCart] = useState<Ingredient[]>(() => {
      const saved = localStorage.getItem('christmas_cart');
      return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
      const saved = localStorage.getItem('christmas_favs');
      return saved ? JSON.parse(saved) : [];
  });

  // Checklist de ingredientes (Local)
  const [preppedIngredients, setPreppedIngredients] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const previousStepRef = useRef(0);
  const hasSpokenInit = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => { localStorage.setItem('christmas_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('christmas_favs', JSON.stringify(favorites)); }, [favorites]);

  const speakRobust = useCallback((text: string, onEnd?: () => void) => {
    if (!settings.voiceEnabled) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95; 
    utterance.onend = () => { setStatus('idle'); onEnd?.(); };
    setStatus('speaking');
    window.speechSynthesis.speak(utterance);
  }, [settings.voiceEnabled]);

  const startListening = () => {
    if (!SpeechRecognition) return;
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.onstart = () => { isListeningRef.current = true; setStatus('listening'); };
        recognition.onend = () => { isListeningRef.current = false; if (status === 'listening') setStatus('idle'); };
        recognition.onresult = (e: any) => handleVoiceCommand(e.results[0][0].transcript.toLowerCase());
        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) { setStatus('idle'); }
  };

  // Fix: Missing stopListening function
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleVoiceCommand = (command: string) => {
      if (command.includes('siguiente') || command.includes('pasa')) {
          if (activeRecipe && currentStep < activeRecipe.steps.length - 1) setCurrentStep(prev => prev + 1);
      } else if (command.includes('atrás') || command.includes('anterior')) {
          if (currentStep > 0) setCurrentStep(prev => prev - 1);
      } else if (command.includes('repetir')) {
          speakRobust(activeRecipe?.steps[currentStep].description || "");
      } else {
          askLocalAssistant(command);
      }
  };

  const askLocalAssistant = async (query?: string) => {
      if (!activeRecipe) return;
      setStatus('processing');
      const text = await generateCookingAssistance(activeRecipe, currentStep, query || "");
      speakRobust(text);
  };

  const goHome = () => { setView({ type: 'HOME' }); setSearchTerm(''); setActiveFilter(null); };

  const filteredRecipes = useMemo(() => {
    let list = SAMPLE_RECIPES;
    if (searchTerm) {
      list = list.filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.tags.some(t => t.includes(searchTerm.toLowerCase())));
    }
    if (activeFilter) {
      list = list.filter(r => r.tags.includes(activeFilter));
    }
    return list;
  }, [searchTerm, activeFilter]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const getProgress = () => {
    if (!activeRecipe) return 0;
    return Math.round(((currentStep + 1) / activeRecipe.steps.length) * 100);
  };

  const getAggregatedCart = () => {
      const agg: Record<string, { amount: number, unit: string }> = {};
      cart.forEach(item => {
          const key = item.name.toLowerCase();
          if (agg[key]) {
              agg[key].amount += item.amount;
          } else {
              agg[key] = { amount: item.amount, unit: item.unit };
          }
      });
      return Object.entries(agg).map(([name, data]) => ({ name, ...data }));
  };

  // --- STYLES ---
  const bgColor = settings.highContrast ? 'bg-gray-900' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const accentText = settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red';
  const cardBg = settings.highContrast ? 'bg-gray-800 border-gray-600' : 'bg-white border-christmas-gold/30';

  if (showIntro) {
      return (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
              <ChefHat size={80} className="mb-6 animate-bounce text-christmas-accent" />
              <h1 className="text-5xl font-serif font-bold mb-4">Navidad en la Mesa</h1>
              <p className="text-xl mb-12 opacity-90 max-w-md">Asistente Culinario Festivo.</p>
              <button onClick={() => { setShowIntro(false); speakRobust("Bienvenido."); }} className="px-12 py-6 text-2xl font-bold rounded-full shadow-2xl bg-christmas-green text-white border-4 border-christmas-gold">Entrar</button>
          </div>
      );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-colors duration-300`}>
        <header className={`p-4 flex justify-between items-center shadow-md sticky top-0 z-40 ${settings.highContrast ? 'bg-christmas-dark border-b' : 'bg-christmas-red text-white'}`}>
            <div onClick={goHome} className="flex items-center gap-2 cursor-pointer font-serif font-bold text-xl"><ChefHat /> <span className="hidden sm:inline">Navidad en la Mesa</span></div>
            <div className="flex gap-2">
                <button onClick={() => setView({type: 'CART'})} className="p-2 rounded-full hover:bg-white/10 relative"><ShoppingCart />{cart.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-christmas-accent rounded-full"/>}</button>
                <button onClick={() => setView({type: 'SETTINGS'})} className="p-2 rounded-full hover:bg-white/10"><SettingsIcon /></button>
            </div>
        </header>

        <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-32">
            
            {(view.type === 'HOME' || view.type === 'CATEGORY') && (
                <div className="space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-christmas-gold opacity-50" />
                        <input 
                            type="text"
                            placeholder="Buscar receta (p.ej. Bacalao, Galletas, Vegano...)"
                            className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 focus:ring-4 outline-none transition-all ${cardBg}`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['tradicional', 'vegano', 'sin gluten', 'marisco', 'niños'].map(tag => (
                            <button 
                                key={tag}
                                onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                                className={`px-4 py-1 rounded-full text-xs font-bold uppercase transition-all border-2 whitespace-nowrap
                                    ${activeFilter === tag ? 'bg-christmas-gold border-christmas-gold text-white' : 'bg-white border-christmas-gold/20 text-christmas-gold'}`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {!searchTerm && view.type === 'HOME' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {Object.values(Category).map(cat => (
                                <button key={cat} onClick={() => setView({type: 'CATEGORY', category: cat})} className={`p-8 text-left text-2xl font-serif font-bold rounded-xl border-2 ${cardBg} text-christmas-green`}>{cat}</button>
                            ))}
                        </div>
                    )}

                    {(searchTerm || view.type === 'CATEGORY') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredRecipes.filter(r => view.type === 'CATEGORY' ? r.category === view.category : true).map(recipe => (
                                <div key={recipe.id} onClick={() => { setActiveRecipe(recipe); setView({type: 'RECIPE', recipeId: recipe.id}); }} className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:shadow-xl ${cardBg}`}>
                                    <div className="h-40 relative"><img src={recipe.imageUrl} className="w-full h-full object-cover" alt={recipe.title} /></div>
                                    <div className="p-4"><h3 className="font-bold font-serif">{recipe.title}</h3><p className="text-xs opacity-60 line-clamp-1">{recipe.description}</p></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view.type === 'RECIPE' && activeRecipe && (
                <div className="space-y-6 animate-fade-in">
                    <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 opacity-70"><ChevronLeft /> Volver</button>
                    <div className={`rounded-2xl overflow-hidden shadow-xl ${cardBg}`}>
                        <img src={activeRecipe.imageUrl} className="w-full h-64 object-cover border-b-4 border-christmas-gold" alt={activeRecipe.title} />
                        <div className="p-6 md:p-8 space-y-6">
                            <h1 className={`text-4xl font-serif font-bold text-center ${accentText}`}>{activeRecipe.title}</h1>
                            
                            <div className="flex justify-between items-center border-b pb-4">
                                <h3 className="text-xl font-bold font-serif">Mise en Place (Ingredientes)</h3>
                                <button onClick={() => setCart([...cart, ...activeRecipe.ingredients])} className="text-sm bg-christmas-green text-white px-4 py-2 rounded-full flex items-center gap-1"><Plus size={16}/> Carro</button>
                            </div>

                            <ul className="grid gap-2">
                                {activeRecipe.ingredients.map((ing, i) => (
                                    <li key={i} onClick={() => setPreppedIngredients({...preppedIngredients, [ing.name]: !preppedIngredients[ing.name]})} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-black/5 transition-colors">
                                        <CheckCircle2 className={preppedIngredients[ing.name] ? "text-christmas-green" : "text-gray-300"} />
                                        <span className={preppedIngredients[ing.name] ? "line-through opacity-40" : ""}>{ing.name} - <b>{ing.amount} {ing.unit}</b></span>
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => { setView({type: 'COOKING', recipeId: activeRecipe.id}); setCurrentStep(0); }} className="w-full py-6 text-2xl font-bold rounded-2xl bg-christmas-green text-white shadow-xl flex justify-center gap-3"><Play fill="white" /> Empezar a Cocinar</button>
                        </div>
                    </div>
                </div>
            )}

            {view.type === 'CART' && (
                <div className="space-y-6">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100">
                        <ChevronLeft /> Volver al inicio
                    </button>
                    <div className="flex justify-between items-center">
                        <h2 className={`text-3xl font-serif font-bold ${accentText}`}>Lista de Compra</h2>
                        {cart.length > 0 && (
                            <button onClick={() => setCart([])} className="text-red-500 flex items-center gap-1 font-bold px-3 py-1 hover:bg-red-50 rounded">
                                <Trash2 size={18} /> Vaciar Todo
                            </button>
                        )}
                    </div>
                    {cart.length === 0 ? (
                        <div className={`text-center py-20 rounded-xl ${cardBg}`}>
                            <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-xl opacity-60">Tu carrito está vacío.</p>
                        </div>
                    ) : (
                        <div className={`rounded-xl shadow-lg overflow-hidden ${cardBg}`}>
                             <ul className="divide-y divide-gray-200">
                                 {getAggregatedCart().map((item, idx) => (
                                     <li key={idx} className="p-4 flex justify-between items-center hover:bg-black/5">
                                         <span className="text-lg">{item.name}</span>
                                         <span className="font-bold text-lg">{item.amount} {item.unit}</span>
                                     </li>
                                 ))}
                             </ul>
                        </div>
                    )}
                </div>
            )}

            {view.type === 'SETTINGS' && (
                <div className="space-y-6">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100">
                        <ChevronLeft /> Volver al inicio
                    </button>
                    <h2 className={`text-3xl font-serif font-bold ${accentText}`}>Configuración</h2>
                    <div className={`p-6 rounded-xl shadow-lg space-y-8 ${cardBg}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Alto Contraste</h3>
                                <p className="opacity-70 text-sm">Mejora la visibilidad.</p>
                            </div>
                            <button onClick={() => setSettings({...settings, highContrast: !settings.highContrast})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-christmas-accent' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings.highContrast ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Asistente de Voz</h3>
                                <p className="opacity-70 text-sm">Escucha y lee recetas.</p>
                            </div>
                            <button onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.voiceEnabled ? 'bg-christmas-green' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings.voiceEnabled ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col h-[75vh]">
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1 text-xs font-bold opacity-60">
                            <span>PROGRESO DE LA RECETA</span>
                            <span>{getProgress()}%</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow-inner">
                            <div className="h-full bg-christmas-green transition-all duration-500" style={{ width: `${getProgress()}%` }} />
                        </div>
                    </div>

                    <div className={`flex-1 flex flex-col justify-center items-center p-8 text-center rounded-3xl border-8 shadow-2xl relative ${settings.highContrast ? 'bg-black border-christmas-accent text-white' : 'bg-white border-christmas-green'}`}>
                        <span className="absolute top-4 left-6 text-6xl font-black opacity-10">{currentStep + 1}</span>
                        <p className="text-3xl font-bold font-serif leading-tight mb-8">{activeRecipe.steps[currentStep].description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 my-8">
                        <button disabled={currentStep === 0} onClick={() => setCurrentStep(c => c - 1)} className="p-6 rounded-2xl bg-white border-2 border-gray-200 font-bold flex justify-center gap-2"><ChevronLeft /> Anterior</button>
                        <button disabled={currentStep === activeRecipe.steps.length - 1} onClick={() => setCurrentStep(c => c + 1)} className="p-6 rounded-2xl bg-christmas-green text-white font-bold flex justify-center gap-2">Siguiente <ChevronRight /></button>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 z-50">
                        <button onClick={() => { if (status === 'listening') stopListening(); else startListening(); }} className={`w-full py-10 flex flex-col items-center justify-center border-t-8 shadow-2xl transition-all ${status === 'listening' ? 'bg-christmas-accent animate-pulse' : 'bg-christmas-red text-white border-christmas-gold'}`}>
                            <Mic size={48} />
                            <span className="text-2xl font-black uppercase tracking-widest mt-2">{status === 'listening' ? 'Dime algo...' : 'Asistente IA'}</span>
                        </button>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
}
