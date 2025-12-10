import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category, Recipe, ViewState, AppSettings, Ingredient, AppStatus } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { 
  Mic, ChevronLeft, ChevronRight, Clock, Play, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, 
  Plus, Trash2, X 
} from 'lucide-react';

// Polyfill para SpeechRecognition para mayor compatibilidad
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  // --- STATE ---
  const [showIntro, setShowIntro] = useState(true);
   
  // Navigation & Settings
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [settings, setSettings] = useState<AppSettings>({
    highContrast: false,
    fontSizeMultiplier: 1,
    voiceEnabled: true,
  });

  // Data State
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [cart, setCart] = useState<Ingredient[]>(() => {
      const saved = localStorage.getItem('christmas_cart');
      return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
      const saved = localStorage.getItem('christmas_favs');
      return saved ? JSON.parse(saved) : [];
  });

  // Cooking Mode State
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<AppStatus>('idle');
   
  // Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Refs
  const previousStepRef = useRef(0);
  const hasSpokenInit = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('christmas_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('christmas_favs', JSON.stringify(favorites));
  }, [favorites]);

  // --- AUDIO HELPERS ---

  const speakRobust = useCallback((text: string, onEnd?: () => void) => {
    if (!settings.voiceEnabled) {
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9; 
    
    utterance.onend = () => {
      setStatus('idle');
      if (onEnd) onEnd();
    };
    
    utterance.onerror = (e) => {
       // Ignore interruption errors
       if (e.error !== 'interrupted' && e.error !== 'canceled') {
         setStatus('idle');
         if (onEnd) onEnd();
       }
    };
    
    setStatus('speaking');
    window.speechSynthesis.speak(utterance);
  }, [settings.voiceEnabled]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
      }
  };

  // --- VOICE RECOGNITION ---

  const startListening = () => {
    if (!SpeechRecognition) {
        alert("Tu navegador no soporta reconocimiento de voz.");
        return;
    }
    if (!navigator.onLine) {
        speakRobust("No tienes conexión a internet para el asistente.");
        return;
    }
    if (status === 'speaking') {
        window.speechSynthesis.cancel();
    }

    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListeningRef.current = true;
            setStatus('listening');
        };

        recognition.onend = () => {
            isListeningRef.current = false;
            // Solo volver a idle si no estamos procesando ni hablando
            if (status === 'listening') {
                 setStatus('idle');
            }
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            handleVoiceCommand(transcript);
        };

        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) {
        console.error("Error starting recognition", e);
        setStatus('idle');
    }
  };

  const handleVoiceCommand = (command: string) => {
      console.log("Comando oído:", command);
      
      // Comandos de Navegación
      if (command.includes('siguiente') || command.includes('avanza') || command.includes('próximo') || command.includes('pasa')) {
          if (activeRecipe && currentStep < activeRecipe.steps.length - 1) {
              setCurrentStep(prev => prev + 1);
          } else {
              speakRobust("Ya estás en el último paso.");
          }
      } else if (command.includes('anterior') || command.includes('atrás') || command.includes('vuelve') || command.includes('retrocede')) {
          if (currentStep > 0) {
              setCurrentStep(prev => prev - 1);
          } else {
              speakRobust("Estás en el primer paso.");
          }
      } else if (command.includes('repetir') || command.includes('repite') || command.includes('qué')) {
          speakRobust(activeRecipe?.steps[currentStep].description || "");
      } else if (command.includes('salir') || command.includes('terminar') || command.includes('inicio')) {
          goHome();
          speakRobust("Saliendo de la cocina.");
      } else if (command.includes('temporizador') || command.includes('tiempo') || command.includes('cuenta')) {
          if (activeRecipe?.steps[currentStep].timerMinutes) {
              toggleTimer();
              speakRobust(timerActive ? "Temporizador pausado." : "Temporizador iniciado.");
          } else {
              speakRobust("Este paso no tiene tiempo predefinido.");
          }
      } else {
          // Fallback to AI
          askGemini(command);
      }
  };

  const stopListening = () => {
      if (recognitionRef.current) {
          recognitionRef.current.stop();
      }
  };

  const toggleVoice = () => {
      if (status === 'listening') {
          stopListening();
      } else {
          speakRobust("Te escucho.", () => startListening());
      }
  };

  // --- APP LOGIC ---

  const handleEnterApp = () => {
    setShowIntro(false);
    window.speechSynthesis.cancel();
    setTimeout(() => {
        speakRobust("Bienvenido a Navidad en la Mesa. ¿Qué te apetece cocinar hoy?", () => setStatus('idle'));
    }, 500);
  };

  // Timer Logic
  useEffect(() => {
    let interval: any;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
             if (prev <= 1) {
                 speakRobust("¡El tiempo ha terminado!");
                 setTimerActive(false);
                 return 0;
             }
             return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, speakRobust]);

  // Step Change & Auto-Read Logic
  useEffect(() => {
    if (view.type === 'COOKING' && activeRecipe) {
        requestWakeLock();
        const recipe = activeRecipe;
        const step = recipe.steps[currentStep];

        // Reset timer on step change if it's not running or belongs to prev step
        if (step.timerMinutes && !timerActive) {
            setTimeLeft(step.timerMinutes * 60);
        } else if (!step.timerMinutes) {
            setTimeLeft(0);
            setTimerActive(false);
        }

        if (!hasSpokenInit.current) {
            hasSpokenInit.current = true;
            const intro = `Bienvenido a la cocina. Vamos a preparar ${recipe.title}. Paso 1 de ${recipe.steps.length}. ${step.description}`;
             speakRobust(intro, () => setStatus('idle'));
             return; 
        }

        if (hasSpokenInit.current) {
            const direction = currentStep > previousStepRef.current ? 'next' : currentStep < previousStepRef.current ? 'prev' : 'same';
            if (direction === 'same' && currentStep === previousStepRef.current) return;

            let introPhrase = `Paso ${currentStep + 1} de ${recipe.steps.length}.`;
            if (direction === 'next') introPhrase = `Avanzando al paso ${currentStep + 1}:`;
            else if (direction === 'prev') introPhrase = `Volviendo al paso ${currentStep + 1}:`;

            previousStepRef.current = currentStep;

            setTimeout(() => {
                let fullText = `${introPhrase} ${step.description}`;
                if (step.timerMinutes) fullText += ` Este paso tiene un tiempo de ${step.timerMinutes} minutos.`;
                speakRobust(fullText, () => setStatus('idle'));
            }, 200);
        }
    } else {
        releaseWakeLock();
    }
  }, [currentStep, view.type, activeRecipe, speakRobust]);

  // Cart Logic
  const addToCart = () => {
      if (activeRecipe) {
          const newIngredients = [...cart, ...activeRecipe.ingredients];
          setCart(newIngredients);
          alert('Ingredientes añadidos al carro');
      }
  };

  const clearCart = () => {
      if (window.confirm('¿Estás seguro de que quieres vaciar la lista de la compra?')) {
          setCart([]);
      }
  };

  const toggleFavorite = (id: string) => {
      if (favorites.includes(id)) {
          setFavorites(favorites.filter(fid => fid !== id));
      } else {
          setFavorites([...favorites, id]);
      }
  };

  // Helper to aggregate cart ingredients
  const getAggregatedCart = () => {
      const agg: Record<string, { amount: number, unit: string, checked: boolean }> = {};
      cart.forEach(item => {
          const key = item.name.toLowerCase();
          if (agg[key]) {
              agg[key].amount += item.amount;
          } else {
              agg[key] = { amount: item.amount, unit: item.unit, checked: false };
          }
      });
      return Object.entries(agg).map(([name, data]) => ({ name, ...data }));
  };

  // Navigation
  const goHome = () => setView({ type: 'HOME' });
  const selectCategory = (category: Category) => setView({ type: 'CATEGORY', category });
  const selectRecipe = (recipeId: string) => {
      const r = SAMPLE_RECIPES.find(r => r.id === recipeId);
      if (r) {
        setActiveRecipe(r);
        setView({ type: 'RECIPE', recipeId });
      }
  };
  const startCooking = (recipeId: string) => {
    const r = SAMPLE_RECIPES.find(r => r.id === recipeId);
    if (r) {
        setActiveRecipe(r);
        setCurrentStep(0);
        previousStepRef.current = 0;
        hasSpokenInit.current = false;
        setView({ type: 'COOKING', recipeId });
    }
  };

  const askGemini = async (query?: string) => {
      if (!activeRecipe) return;
      updateStatus('processing');
      const q = query || "Explícame este paso";
      try {
        const text = await generateCookingAssistance(activeRecipe, currentStep, q);
        speakRobust(text, () => setStatus('idle'));
      } catch (e) {
        speakRobust("No puedo conectar con el chef ahora.", () => setStatus('idle'));
      }
  };

  const updateStatus = (s: AppStatus) => setStatus(s);
  const toggleTimer = () => setTimerActive(!timerActive);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- STYLES ---
  const baseTextSize = settings.fontSizeMultiplier === 1.5 ? 'text-xl' : settings.fontSizeMultiplier === 1.25 ? 'text-lg' : 'text-base';
  const headingSize = settings.fontSizeMultiplier === 1.5 ? 'text-4xl' : settings.fontSizeMultiplier === 1.25 ? 'text-3xl' : 'text-2xl';
  const bgColor = settings.highContrast ? 'bg-gray-900' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const accentText = settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red';
  const btnPrimary = settings.highContrast 
      ? 'bg-christmas-accent text-gray-900 hover:bg-yellow-300' 
      : 'bg-christmas-green text-white hover:bg-green-800 shadow-lg';
  const cardBg = settings.highContrast ? 'bg-gray-800 border-gray-600' : 'bg-white border-christmas-gold/30';

  // --- RENDER ---

  if (showIntro) {
      return (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
              <ChefHat size={80} className="mb-6 animate-bounce text-christmas-accent" />
              <h1 className="text-5xl font-serif font-bold mb-4">Navidad en la Mesa</h1>
              <p className="text-xl mb-12 opacity-90 max-w-md">Tu asistente culinario festivo y accesible.</p>
              <button 
                  onClick={handleEnterApp}
                  className={`px-12 py-6 text-2xl font-bold rounded-full shadow-2xl transition-transform transform active:scale-95 ${settings.highContrast ? 'bg-christmas-accent text-black' : 'bg-christmas-green text-white border-4 border-christmas-gold'}`}
              >
                  Entrar a la Cocina
              </button>
          </div>
      );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-colors duration-300 ${baseTextSize}`}>
        {/* HEADER */}
        <header className={`p-4 flex justify-between items-center shadow-md sticky top-0 z-40 ${settings.highContrast ? 'bg-christmas-dark border-b border-gray-700' : 'bg-christmas-red text-white'}`}>
            <div onClick={goHome} className="flex items-center gap-2 cursor-pointer font-serif font-bold text-xl hover:opacity-90">
                <ChefHat /> <span className="hidden sm:inline">Navidad en la Mesa</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setView({type: 'CART'})} className="p-2 rounded-full hover:bg-white/10 relative">
                    <ShoppingCart />
                    {cart.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-christmas-accent rounded-full animate-pulse"/>}
                </button>
                <button onClick={() => setView({type: 'SETTINGS'})} className="p-2 rounded-full hover:bg-white/10">
                    <SettingsIcon />
                </button>
            </div>
        </header>

        <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-32">
            
            {/* HOME VIEW */}
            {view.type === 'HOME' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="text-center py-8">
                        <h1 className={`${headingSize} font-serif font-bold ${accentText} mb-2`}>¿Qué cocinamos hoy?</h1>
                        <p className="opacity-75">Selecciona una categoría para empezar</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {(Object.values(Category) as Category[]).map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => selectCategory(cat)}
                                className={`w-full p-8 text-left text-2xl font-serif font-bold rounded-xl border-2 transition-all transform hover:-translate-y-1 hover:shadow-xl
                                    ${settings.highContrast 
                                        ? 'bg-gray-800 border-christmas-accent text-christmas-accent hover:bg-gray-700' 
                                        : 'bg-white border-christmas-gold text-christmas-green hover:border-christmas-red'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="mt-8 p-6 rounded-xl bg-christmas-gold/10 border border-christmas-gold/30 text-center">
                        <h3 className="font-bold text-lg mb-2">¡Feliz Navidad!</h3>
                        <p className="italic opacity-80">Hay {SAMPLE_RECIPES.length} recetas esperando ser cocinadas.</p>
                    </div>
                </div>
            )}

            {/* CATEGORY VIEW */}
            {view.type === 'CATEGORY' && (
                <div className="space-y-6">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100 font-medium px-2 py-1 rounded hover:bg-black/5">
                        <ChevronLeft /> Volver al inicio
                    </button>
                    <h2 className={`${headingSize} font-serif font-bold ${accentText} border-b-2 border-christmas-gold/20 pb-4`}>{view.category}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SAMPLE_RECIPES.filter(r => r.category === view.category).map(recipe => (
                            <div 
                                key={recipe.id} 
                                onClick={() => selectRecipe(recipe.id)} 
                                className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:shadow-2xl group flex flex-col ${cardBg}`}
                            >
                                <div className="h-48 overflow-hidden relative border-b-[3px] border-christmas-gold">
                                    <img 
                                        src={recipe.imageUrl} 
                                        alt={`Foto de ${recipe.title}. ${recipe.description}`} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                    />
                                    <div className="absolute top-2 right-2">
                                        {favorites.includes(recipe.id) && <Heart fill="red" className="text-red-500 drop-shadow-md" />}
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-between items-end">
                                        <span className="text-white text-xs font-bold flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                                            <Clock size={12} /> {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className={`font-bold font-serif text-xl leading-tight mb-2 ${settings.highContrast ? 'text-white' : 'text-christmas-dark'}`}>{recipe.title}</h3>
                                    <div className="mt-auto pt-2 flex gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${settings.highContrast ? 'bg-gray-700 text-white' : 'bg-christmas-green/10 text-christmas-green'}`}>
                                            {recipe.difficulty}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* RECIPE DETAIL VIEW */}
            {view.type === 'RECIPE' && activeRecipe && (
                <div className="space-y-6 pb-20 animate-fade-in">
                    <button 
                        onClick={() => selectCategory(activeRecipe.category)} 
                        className="flex items-center gap-2 opacity-70 hover:opacity-100 font-medium px-2 py-1 rounded hover:bg-black/5"
                    >
                        <ChevronLeft /> Volver a {activeRecipe.category}
                    </button>
                    
                    <div className={`rounded-2xl shadow-xl overflow-hidden ${settings.highContrast ? 'bg-gray-800' : 'bg-white'}`}>
                        {/* Hero Image */}
                        <div className="relative h-72 md:h-96">
                            <img 
                                src={activeRecipe.imageUrl} 
                                alt={`Plato: ${activeRecipe.title}. Descripción: ${activeRecipe.description}`} 
                                className="w-full h-full object-cover rounded-b-[2.5rem] border-b-[3px] border-christmas-gold shadow-lg z-10 relative" 
                            />
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(activeRecipe.id); }}
                                className="absolute top-4 right-4 p-3 rounded-full bg-white/90 shadow-lg z-20 hover:scale-110 transition-transform"
                            >
                                <Heart 
                                    size={24} 
                                    className={favorites.includes(activeRecipe.id) ? "fill-red-500 text-red-500" : "text-gray-400"} 
                                />
                            </button>
                        </div>
                        
                        <div className="p-6 md:p-8 space-y-8 -mt-4 pt-8">
                            <div className="text-center space-y-4">
                                <h1 className={`text-3xl md:text-5xl font-serif font-bold ${accentText}`}>{activeRecipe.title}</h1>
                                <p className="text-lg opacity-80 italic max-w-2xl mx-auto">{activeRecipe.description}</p>
                            </div>

                            {/* Info Bar */}
                            <div className={`grid grid-cols-3 gap-4 text-center py-6 rounded-xl border-2 ${settings.highContrast ? 'border-gray-600 bg-gray-700' : 'border-christmas-gold/20 bg-christmas-gold/5'}`}>
                                <div>
                                    <div className="flex justify-center mb-1 text-christmas-gold"><Clock size={20} /></div>
                                    <span className="block text-xs uppercase tracking-wider opacity-60">Prep</span>
                                    <span className="font-bold text-xl">{activeRecipe.prepTimeMinutes} m</span>
                                </div>
                                <div>
                                    <div className="flex justify-center mb-1 text-christmas-gold"><ChefHat size={20} /></div>
                                    <span className="block text-xs uppercase tracking-wider opacity-60">Cocina</span>
                                    <span className="font-bold text-xl">{activeRecipe.cookTimeMinutes} m</span>
                                </div>
                                <div>
                                    <div className="flex justify-center mb-1 text-christmas-gold"><Play size={20} className="rotate-90"/></div>
                                    <span className="block text-xs uppercase tracking-wider opacity-60">Dificultad</span>
                                    <span className="font-bold text-xl">{activeRecipe.difficulty}</span>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
                                        <h3 className={`text-2xl font-bold font-serif ${accentText}`}>Ingredientes</h3>
                                        <button 
                                            onClick={addToCart}
                                            className={`text-sm flex items-center gap-1 font-bold px-4 py-2 rounded-full transition-colors shadow-sm ${settings.highContrast ? 'bg-christmas-accent text-black' : 'bg-christmas-red text-white hover:bg-red-800'}`}
                                        >
                                            <Plus size={16}/> Añadir al carro
                                        </button>
                                    </div>
                                    <ul className="space-y-3">
                                        {activeRecipe.ingredients.map((ing, i) => (
                                            <li key={i} className="flex justify-between items-center p-3 rounded-lg hover:bg-black/5 transition-colors">
                                                <span className="font-medium">{ing.name}</span>
                                                <span className={`font-bold ${accentText}`}>{ing.amount} {ing.unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                                    <h3 className={`text-xl font-bold font-serif mb-4 ${accentText}`}>Pasos ({activeRecipe.steps.length})</h3>
                                    <div className="space-y-4 text-sm opacity-80">
                                        {activeRecipe.steps.slice(0, 3).map((s, i) => (
                                            <p key={i} className="line-clamp-2"><span className="font-bold mr-2 text-christmas-gold">{i+1}.</span> {s.description}</p>
                                        ))}
                                        {activeRecipe.steps.length > 3 && <p className="italic">... y {activeRecipe.steps.length - 3} pasos más.</p>}
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => startCooking(activeRecipe.id)} 
                                className={`w-full py-5 text-2xl font-bold rounded-xl shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95 border-2 border-transparent hover:border-white/20 ${btnPrimary}`}
                            >
                                <Play fill="currentColor" size={28} /> ¡Empezar a Cocinar!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CART VIEW */}
            {view.type === 'CART' && (
                <div className="space-y-6">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100">
                        <ChevronLeft /> Volver al inicio
                    </button>
                    <div className="flex justify-between items-center">
                        <h2 className={`${headingSize} font-serif font-bold ${accentText}`}>Lista de Compra</h2>
                        {cart.length > 0 && (
                            <button onClick={clearCart} className="text-red-500 flex items-center gap-1 font-bold px-3 py-1 hover:bg-red-50 rounded">
                                <Trash2 size={18} /> Vaciar Todo
                            </button>
                        )}
                    </div>

                    {cart.length === 0 ? (
                        <div className={`text-center py-20 rounded-xl ${cardBg}`}>
                            <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-xl opacity-60">Tu carrito está vacío.</p>
                            <p className="opacity-40 text-sm">Añade ingredientes desde las recetas.</p>
                        </div>
                    ) : (
                        <div className={`rounded-xl shadow-lg overflow-hidden ${cardBg}`}>
                             <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                 {getAggregatedCart().map((item, idx) => (
                                     <li key={idx} className="p-4 flex justify-between items-center hover:bg-black/5">
                                         <div className="flex items-center gap-3">
                                             <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${settings.highContrast ? 'border-christmas-accent' : 'border-christmas-green'}`}>
                                                 {/* Checkbox visual placeholder */}
                                             </div>
                                             <span className="text-lg">{item.name}</span>
                                         </div>
                                         <span className="font-bold font-mono text-lg">{item.amount} {item.unit}</span>
                                     </li>
                                 ))}
                             </ul>
                        </div>
                    )}
                </div>
            )}

            {/* SETTINGS VIEW */}
            {view.type === 'SETTINGS' && (
                <div className="space-y-6">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100">
                        <ChevronLeft /> Volver al inicio
                    </button>
                    <h2 className={`${headingSize} font-serif font-bold ${accentText}`}>Configuración</h2>
                    
                    <div className={`p-6 rounded-xl shadow-lg space-y-8 ${cardBg}`}>
                        {/* High Contrast */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Modo Oscuro / Alto Contraste</h3>
                                <p className="opacity-70 text-sm">Mejora la visibilidad en ambientes oscuros.</p>
                            </div>
                            <button 
                                onClick={() => setSettings({...settings, highContrast: !settings.highContrast})}
                                className={`w-16 h-9 rounded-full p-1 transition-colors duration-300 ${settings.highContrast ? 'bg-christmas-accent' : 'bg-gray-300'}`}
                            >
                                <div className={`w-7 h-7 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.highContrast ? 'translate-x-7' : ''}`} />
                            </button>
                        </div>

                        {/* Voice */}
                        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-6">
                            <div>
                                <h3 className="text-xl font-bold">Asistente de Voz</h3>
                                <p className="opacity-70 text-sm">Lectura automática y comandos de voz.</p>
                            </div>
                            <button 
                                onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})}
                                className={`w-16 h-9 rounded-full p-1 transition-colors duration-300 ${settings.voiceEnabled ? 'bg-christmas-green' : 'bg-gray-300'}`}
                            >
                                <div className={`w-7 h-7 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.voiceEnabled ? 'translate-x-7' : ''}`} />
                            </button>
                        </div>

                        {/* Font Size */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="text-xl font-bold mb-4">Tamaño de Texto</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {[1, 1.25, 1.5].map((size) => (
                                    <button 
                                        key={size}
                                        onClick={() => setSettings({...settings, fontSizeMultiplier: size})}
                                        className={`py-4 rounded-xl font-bold border-2 transition-all
                                            ${settings.fontSizeMultiplier === size 
                                                ? (settings.highContrast ? 'bg-christmas-accent text-black border-christmas-accent' : 'bg-christmas-red text-white border-christmas-red')
                                                : 'border-gray-300 text-gray-500 hover:border-gray-400'
                                            }`}
                                    >
                                        {size === 1 ? 'Normal' : size === 1.25 ? 'Grande' : 'Extra'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* COOKING MODE */}
            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col h-[calc(100vh-80px)]">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => selectRecipe(activeRecipe.id)} className="text-sm font-bold opacity-70 hover:opacity-100 flex items-center gap-2 px-3 py-2 bg-black/5 rounded-lg">
                            <X size={18} /> Salir
                        </button>
                        <div className="text-right">
                            <h3 className="font-serif font-bold text-lg leading-none">{activeRecipe.title}</h3>
                            <span className="text-xs opacity-60">Paso {currentStep + 1} de {activeRecipe.steps.length}</span>
                        </div>
                    </div>
                    
                    {/* Step Card */}
                    <div className={`flex-1 flex flex-col justify-center items-center p-8 text-center rounded-3xl shadow-inner border-[6px] mb-8 relative overflow-hidden transition-all duration-300
                        ${settings.highContrast ? 'bg-black border-christmas-accent' : 'bg-white border-christmas-green'}`}>
                        
                        <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
                            <ChefHat size={120} />
                        </div>

                        <p className={`font-bold leading-relaxed mb-8 ${headingSize} ${settings.highContrast ? 'text-christmas-accent' : 'text-gray-800'}`}>
                            {activeRecipe.steps[currentStep].description}
                        </p>

                        {/* Interactive Timer */}
                        {activeRecipe.steps[currentStep].timerMinutes && (
                            <button 
                                onClick={toggleTimer}
                                className={`w-full max-w-sm p-6 rounded-2xl transition-all transform active:scale-95 shadow-lg border-2
                                    ${timerActive 
                                        ? 'bg-red-50 border-red-500 text-red-600 animate-pulse ring-4 ring-red-200' 
                                        : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-4">
                                    <Clock size={40} />
                                    <span className="text-5xl font-mono font-bold">{formatTime(timeLeft)}</span>
                                </div>
                                <p className="text-sm font-bold uppercase tracking-widest mt-2">
                                    {timerActive ? 'Pausar Temporizador' : 'Iniciar Temporizador'}
                                </p>
                            </button>
                        )}
                    </div>
                    
                    {/* Manual Controls - Redundant and Clear */}
                    <div className="grid grid-cols-2 gap-6 mb-40 px-4">
                         <button 
                            disabled={currentStep === 0} 
                            onClick={() => setCurrentStep(c => Math.max(0, c - 1))}
                            className={`p-6 rounded-2xl flex items-center justify-center gap-3 font-bold text-xl shadow-lg transition-transform active:scale-95
                                ${currentStep === 0 
                                    ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-400' 
                                    : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-200'}`}
                        >
                            <ChevronLeft size={32} /> Anterior
                        </button>
                        <button 
                            disabled={currentStep === activeRecipe.steps.length - 1} 
                            onClick={() => setCurrentStep(c => Math.min(activeRecipe.steps.length - 1, c + 1))}
                            className={`p-6 rounded-2xl flex items-center justify-center gap-3 font-bold text-xl shadow-lg transition-transform active:scale-95
                                ${currentStep === activeRecipe.steps.length - 1 
                                    ? 'bg-christmas-green/50 cursor-not-allowed' 
                                    : 'bg-christmas-green text-white hover:bg-green-800 border-2 border-transparent'}`}
                        >
                            Siguiente <ChevronRight size={32} />
                        </button>
                    </div>

                    {/* BLIND-FIRST VOICE BAR */}
                    <div className="fixed bottom-0 left-0 right-0 z-50">
                        <button 
                            onClick={toggleVoice}
                            className={`w-full py-10 flex flex-col items-center justify-center transition-all duration-300 border-t-8 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]
                                ${status === 'listening' 
                                    ? 'bg-christmas-accent border-christmas-red text-black animate-pulse' 
                                    : settings.highContrast ? 'bg-yellow-400 text-black border-white' : 'bg-christmas-red text-white border-christmas-gold'
                                }`}
                            aria-label={status === 'listening' ? "Micrófono activo. Di un comando." : "Activar control por voz. Comandos disponibles: Siguiente, Anterior, Repetir, Temporizador, Salir."}
                            aria-live="assertive"
                            aria-pressed={status === 'listening'}
                        >
                             {status === 'listening' ? (
                                 <div className="flex items-center gap-4">
                                    <Mic size={56} className="animate-bounce" />
                                    <span className="text-3xl font-black tracking-widest uppercase">TE ESCUCHO...</span>
                                 </div>
                             ) : (
                                 <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-4 mb-2">
                                        <Mic size={40} />
                                        <span className="text-3xl font-bold uppercase tracking-wide">Toca para hablar</span>
                                    </div>
                                    <span className="text-sm font-medium opacity-90 bg-black/10 px-4 py-1 rounded-full">Di "Siguiente", "Atrás", "Repetir", "Temporizador"</span>
                                 </div>
                             )}
                        </button>
                    </div>
                </div>
            )}

        </main>
    </div>
  );
}
