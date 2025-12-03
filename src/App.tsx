
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category, Recipe, ViewState, AppSettings, Ingredient } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { Mic, ChevronLeft, ChevronRight, Clock, Play, Pause, RotateCcw, Home, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, Volume2, VolumeX, Trash2, Plus } from 'lucide-react';

// Polyfill for SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  // --- STATE ---
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [settings, setSettings] = useState<AppSettings>({
    highContrast: false,
    fontSizeMultiplier: 1,
    voiceEnabled: true,
  });

  // Cart State
  const [cart, setCart] = useState<Ingredient[]>(() => {
      try {
          const saved = localStorage.getItem('navidad_cart');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  // Cooking Mode
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  
  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Refs for Voice Logic (Avoid Stale Closures)
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const currentStepRef = useRef(0);
  const activeRecipeRef = useRef<Recipe | null>(null);
  const viewRef = useRef<ViewState>({ type: 'HOME' });
  const previousStepRef = useRef(0);
  const hasSpokenInit = useRef(false);
  const isTimerRunningRef = useRef(false);

  // Sync refs
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { activeRecipeRef.current = activeRecipe; }, [activeRecipe]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { isTimerRunningRef.current = isTimerRunning; }, [isTimerRunning]);

  // Persist Cart
  useEffect(() => {
      localStorage.setItem('navidad_cart', JSON.stringify(cart));
  }, [cart]);

  // Wake Lock for Cooking Mode (Prevent screen sleep)
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if (view.type === 'COOKING' && 'wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Pantalla mantenida activa.');
        } catch (err) {
          console.log('Error wake lock:', err);
        }
      }
    };
    
    if (view.type === 'COOKING') {
        requestWakeLock();
    }
    
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [view.type]);

  // --- AUDIO HELPERS ---

  const speakRobust = useCallback((text: string, onEnd?: () => void) => {
    if (!settings.voiceEnabled) {
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    
    // Small timeout to ensure browser audio context is clear
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9; // Slightly slower for better accessibility clarity
        
        utterance.onend = () => {
          setStatus('idle');
          if (onEnd) onEnd();
        };
        
        utterance.onerror = () => {
           setStatus('idle');
           if (onEnd) onEnd();
        };
        
        setStatus('speaking');
        window.speechSynthesis.speak(utterance);
    }, 50);
  }, [settings.voiceEnabled]);

  // --- VOICE RECOGNITION CORE ---

  const startListening = () => {
    if (!SpeechRecognition) {
        alert("Tu navegador no soporta control por voz.");
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
            // Auditory feedback if it closes without action (crucial for blind users)
            if (status === 'listening') {
                 setStatus('idle');
            }
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            handleVoiceCommand(transcript);
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') {
                speakRobust("No te he oído. Toca para intentar de nuevo.");
            }
            setStatus('idle');
        };

        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) {
        console.error("Error al iniciar micrófono:", e);
        setStatus('idle');
    }
  };

  const handleVoiceCommand = (command: string) => {
      console.log("Comando oído:", command);
      const step = currentStepRef.current;
      const recipe = activeRecipeRef.current;
      const currentView = viewRef.current;

      // 1. GLOBAL COMMANDS
      if (command.includes('salir') || command.includes('terminar')) {
          if (currentView.type === 'COOKING') {
              speakRobust("Saliendo de la cocina.", () => goHome());
              return;
          }
      }

      // 2. COOKING COMMANDS
      if (currentView.type === 'COOKING' && recipe) {
          
          // Navigation
          if (command.includes('siguiente') || command.includes('avanza') || command.includes('próximo') || command.includes('sigue')) {
              if (step < recipe.steps.length - 1) {
                  setCurrentStep(prev => prev + 1);
              } else {
                  speakRobust("Ya estás en el último paso. ¡Buen provecho!");
              }
              return;
          } 
          
          if (command.includes('anterior') || command.includes('atrás') || command.includes('vuelve') || command.includes('retrocede')) {
              if (step > 0) {
                  setCurrentStep(prev => prev - 1);
              } else {
                  speakRobust("Estás en el primer paso.");
              }
              return;
          }

          // Repetition
          if (command.includes('repetir') || command.includes('repite') || command.includes('qué') || command.includes('lee') || command.includes('otra vez')) {
              const textToRead = recipe.steps[step].description;
              speakRobust(`Paso ${step + 1} de ${recipe.steps.length}. ${textToRead}`);
              return;
          }

          // Timer Control
          if (command.includes('temporizador') || command.includes('tiempo') || command.includes('cuenta')) {
              const stepData = recipe.steps[step];
              if (stepData.timerMinutes) {
                  if (isTimerRunningRef.current) {
                      setIsTimerRunning(false);
                      speakRobust("Temporizador pausado.");
                  } else {
                      if (timerSeconds === 0) {
                          setTimerSeconds(stepData.timerMinutes * 60);
                      }
                      setIsTimerRunning(true);
                      speakRobust(`Iniciando cuenta atrás de ${stepData.timerMinutes} minutos.`);
                  }
              } else {
                  speakRobust("Este paso no tiene tiempo definido.");
              }
              return;
          }
          
          // Gemini Fallback
          askGemini(command);

      } else {
          speakRobust("No te he entendido. Toca una receta para empezar.");
      }
  };

  const toggleVoice = () => {
      if (status === 'listening') {
          if (recognitionRef.current) recognitionRef.current.stop();
      } else {
          speakRobust("Te escucho.", () => startListening());
      }
  };


  // --- APP LOGIC ---

  const handleEnterApp = () => {
    setShowIntro(false);
    speakRobust("Bienvenido a Navidad en la Mesa. ¿Qué te apetece cocinar hoy?", () => setStatus('idle'));
  };

  // Timer Countdown Logic
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      speakRobust("¡El tiempo ha terminado! Revisa el plato.");
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, speakRobust]);

  // Reset timer when changing steps
  useEffect(() => {
      setTimerSeconds(0);
      setIsTimerRunning(false);
  }, [currentStep, activeRecipe]);

  // AUTO-READ STEP LOGIC
  useEffect(() => {
    if (view.type === 'COOKING' && activeRecipe) {
        const recipe = activeRecipe;
        const stepData = recipe.steps[currentStep];
        const totalSteps = recipe.steps.length;

        // Prepare timer if exists
        if (stepData.timerMinutes && timerSeconds === 0 && !isTimerRunning) {
             setTimerSeconds(stepData.timerMinutes * 60);
        }

        const direction = currentStep > previousStepRef.current ? 'next' : currentStep < previousStepRef.current ? 'prev' : 'init';
        
        if (hasSpokenInit.current && direction === 'init' && currentStep === previousStepRef.current) return;

        hasSpokenInit.current = true;
        previousStepRef.current = currentStep;

        // Construcción de frase muy clara y posicional para invidentes
        let phrase = "";
        if (direction === 'init') {
            phrase = `Empezamos con ${recipe.title}. Paso 1 de ${totalSteps}.`;
        } else if (direction === 'next') {
            phrase = `Paso ${currentStep + 1} de ${totalSteps}.`;
        } else if (direction === 'prev') {
            phrase = `Volviendo al paso ${currentStep + 1} de ${totalSteps}.`;
        }

        let fullText = `${phrase} ${stepData.description}`;
        if (stepData.timerMinutes) {
            fullText += ` Tiempo sugerido: ${stepData.timerMinutes} minutos.`;
        }

        setTimeout(() => {
            speakRobust(fullText, () => setStatus('idle'));
        }, 300);
    }
  }, [currentStep, view.type, activeRecipe, speakRobust]);

  // Navigation Helpers
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

  const addToCart = () => {
    if (!activeRecipe) return;
    const newCart = [...cart];
    activeRecipe.ingredients.forEach(ing => {
        const existingIndex = newCart.findIndex(i => i.name.toLowerCase() === ing.name.toLowerCase() && i.unit === ing.unit);
        if (existingIndex >= 0) {
            newCart[existingIndex] = {
                ...newCart[existingIndex],
                amount: newCart[existingIndex].amount + ing.amount
            };
        } else {
            newCart.push({...ing});
        }
    });
    setCart(newCart);
    speakRobust("Ingredientes añadidos a la lista de compra.");
  };

  const clearCart = () => {
    if (window.confirm('¿Estás seguro de que quieres vaciar la lista de la compra?')) {
        setCart([]);
        speakRobust("Lista de compra vaciada.");
    }
  };

  const askGemini = async (query?: string) => {
      if (!activeRecipe) return;
      setStatus('processing');
      const q = query || "Explícame este paso";
      try {
        const text = await generateCookingAssistance(activeRecipe, currentStep, q);
        speakRobust(text, () => setStatus('idle'));
      } catch (e) {
        speakRobust("No puedo conectar con el asistente ahora.", () => setStatus('idle'));
      }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- STYLES ---
  const bgColor = settings.highContrast ? 'bg-gray-900' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-gray-800';
  const cardBg = settings.highContrast ? 'bg-gray-800 border-yellow-400' : 'bg-white border-christmas-gold';
  const accentText = settings.highContrast ? 'text-yellow-400' : 'text-christmas-red';
  const btnPrimary = settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-green text-white hover:bg-green-800';
  const baseTextSize = settings.fontSizeMultiplier === 1.5 ? 'text-xl' : settings.fontSizeMultiplier === 1.25 ? 'text-lg' : 'text-base';
  const headingSize = settings.fontSizeMultiplier === 1.5 ? 'text-4xl' : settings.fontSizeMultiplier === 1.25 ? 'text-3xl' : 'text-2xl';

  // --- INTRO SCREEN ---
  if (showIntro) {
      return (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
              <ChefHat size={80} className="mb-6 animate-bounce" />
              <h1 className="text-5xl font-serif font-bold mb-4">Navidad en la Mesa</h1>
              <p className="text-xl mb-12 opacity-90">Tu asistente de cocina por voz.</p>
              <button 
                  onClick={handleEnterApp}
                  className={`px-10 py-6 text-2xl font-bold rounded-full shadow-xl transition-transform transform active:scale-95 ${settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-green text-white border-4 border-christmas-gold'}`}
              >
                  Entrar a la Cocina
              </button>
          </div>
      );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-colors duration-300`}>
        {/* HEADER */}
        <header className={`p-4 flex justify-between items-center shadow-md ${settings.highContrast ? 'bg-gray-800' : 'bg-christmas-red text-white'}`}>
            <button onClick={goHome} className="flex items-center gap-2 font-serif font-bold text-xl">
                <ChefHat /> Navidad en la Mesa
            </button>
            <div className="flex gap-2">
                <button onClick={() => setView({ type: 'CART' })} className="p-2 rounded hover:bg-white/10 relative">
                    <ShoppingCart />
                    {cart.length > 0 && (
                        <span className="absolute top-1 right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white"></span>
                    )}
                </button>
                <button onClick={() => setView({ type: 'SETTINGS' })} className="p-2 rounded hover:bg-white/10">
                    <SettingsIcon />
                </button>
            </div>
        </header>

        <main className={`flex-1 w-full max-w-3xl mx-auto p-4 ${baseTextSize}`}>
            
            {/* HOME */}
            {view.type === 'HOME' && (
                <div className="space-y-6">
                    <div className="text-center py-8">
                        <h1 className={`${headingSize} font-serif font-bold ${accentText} mb-2`}>¿Qué cocinamos hoy?</h1>
                        <p className="opacity-75">Elige una categoría</p>
                    </div>
                    <div className="grid gap-4">
                        {Object.values(Category).map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => selectCategory(cat)}
                                className={`w-full p-6 text-left text-xl font-bold rounded-xl border-2 transition-all shadow-sm ${cardBg}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* CATEGORY */}
            {view.type === 'CATEGORY' && (
                <div className="space-y-4">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 mb-4"><ChevronLeft /> Inicio</button>
                    <h2 className={`${headingSize} font-serif font-bold ${accentText}`}>{view.category}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {SAMPLE_RECIPES.filter(r => r.category === view.category).map(recipe => (
                            <div key={recipe.id} onClick={() => selectRecipe(recipe.id)} className={`rounded-xl overflow-hidden border-2 cursor-pointer shadow-sm ${cardBg}`}>
                                <div className="h-40 overflow-hidden relative">
                                    <img src={recipe.imageUrl} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute bottom-0 right-0 bg-black/60 text-white px-2 py-1 text-xs font-bold rounded-tl-lg">
                                        {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold font-serif text-lg">{recipe.title}</h3>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* RECIPE DETAIL */}
            {view.type === 'RECIPE' && activeRecipe && (
                <div className="space-y-6 pb-20">
                    <button onClick={() => selectCategory(activeRecipe.category)} className="flex items-center gap-2 opacity-70"><ChevronLeft /> Volver</button>
                    <div className={`rounded-2xl overflow-hidden shadow-xl ${cardBg}`}>
                        <img src={activeRecipe.imageUrl} className="w-full h-64 object-cover" alt="" />
                        <div className="p-6 space-y-6">
                            <h1 className="text-3xl font-serif font-bold">{activeRecipe.title}</h1>
                            <p className="opacity-80 italic">{activeRecipe.description}</p>
                            
                            <div className="flex justify-between text-center py-4 border-y border-gray-200 dark:border-gray-700">
                                <div><span className="block text-xs uppercase">Prep</span><b>{activeRecipe.prepTimeMinutes}m</b></div>
                                <div><span className="block text-xs uppercase">Cocina</span><b>{activeRecipe.cookTimeMinutes}m</b></div>
                                <div><span className="block text-xs uppercase">Dificultad</span><b>{activeRecipe.difficulty}</b></div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className={`text-xl font-bold font-serif ${accentText}`}>Ingredientes</h3>
                                    <button 
                                        onClick={addToCart}
                                        className={`text-sm flex items-center gap-1 font-bold px-3 py-1 rounded transition-colors ${settings.highContrast ? 'bg-gray-700 text-yellow-400' : 'bg-christmas-red/10 text-christmas-red hover:bg-christmas-red/20'}`}
                                    >
                                        <Plus size={16}/> Añadir al carro
                                    </button>
                                </div>
                                <ul className="space-y-2">
                                    {activeRecipe.ingredients.map((ing, i) => (
                                        <li key={i} className="flex justify-between p-2 rounded hover:bg-black/5">
                                            <span>{ing.name}</span>
                                            <b>{ing.amount} {ing.unit}</b>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button onClick={() => startCooking(activeRecipe.id)} className={`w-full py-4 text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${btnPrimary}`}>
                                <Play fill="currentColor" /> ¡Empezar a Cocinar!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CART VIEW */}
            {view.type === 'CART' && (
                <div className="space-y-6">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100"><ChevronLeft /> Volver</button>
                    <div className="flex justify-between items-center">
                        <h2 className={`${headingSize} font-serif font-bold ${accentText}`}>Lista de Compra</h2>
                        {cart.length > 0 && (
                            <button 
                                onClick={clearCart}
                                className={`p-2 rounded-lg flex items-center gap-2 font-bold transition-colors ${settings.highContrast ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            >
                                <Trash2 size={20} /> Vaciar
                            </button>
                        )}
                    </div>

                    <div className={`p-6 rounded-xl shadow-lg ${cardBg}`}>
                        {cart.length === 0 ? (
                            <p className="text-center opacity-60 py-8">Tu carro está vacío. Añade ingredientes desde las recetas.</p>
                        ) : (
                            <ul className="space-y-4">
                                {cart.map((ing, i) => (
                                    <li key={i} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0">
                                        <span className="font-medium text-lg">{ing.name}</span>
                                        <span className="font-bold whitespace-nowrap bg-black/5 px-2 py-1 rounded">{ing.amount.toFixed(1).replace(/[.,]0$/, '')} {ing.unit}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* COOKING MODE */}
            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col h-[calc(100vh-80px)]">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => selectRecipe(activeRecipe.id)} className="text-sm opacity-70 flex items-center gap-1"><VolumeX size={16} /> Salir</button>
                        <span className="font-bold truncate px-2">{activeRecipe.title}</span>
                        <span className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded" aria-live="polite">Paso {currentStep + 1} de {activeRecipe.steps.length}</span>
                    </div>

                    <div className={`flex-1 flex flex-col justify-center items-center p-6 text-center rounded-2xl shadow-inner border-4 mb-4 relative overflow-hidden ${cardBg}`}>
                        <p className={`font-medium mb-8 ${headingSize}`}>{activeRecipe.steps[currentStep].description}</p>

                        {/* TIMER COMPONENT */}
                        {activeRecipe.steps[currentStep].timerMinutes && (
                            <div 
                                onClick={() => setIsTimerRunning(!isTimerRunning)}
                                className={`p-4 rounded-xl w-full max-w-xs cursor-pointer transition-all ${isTimerRunning ? 'bg-red-100 text-red-600 animate-pulse border-red-400' : 'bg-gray-100 text-gray-600'}`}
                            >
                                <div className="flex items-center justify-center gap-2 text-4xl font-mono font-bold">
                                    <Clock size={32} />
                                    {formatTime(timerSeconds > 0 ? timerSeconds : activeRecipe.steps[currentStep].timerMinutes * 60)}
                                </div>
                                <div className="text-xs uppercase font-bold mt-2">
                                    {isTimerRunning ? 'Pausar (o di "Temporizador")' : 'Iniciar (o di "Temporizador")'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MANUAL CONTROLS */}
                    <div className="grid grid-cols-2 gap-4 mb-40">
                        <button 
                            disabled={currentStep === 0}
                            onClick={() => setCurrentStep(c => c - 1)}
                            className={`p-6 rounded-xl font-bold flex justify-center gap-2 shadow-md transition-transform active:scale-95 ${currentStep === 0 ? 'opacity-30' : 'bg-gray-200 text-gray-800'}`}
                            aria-label="Paso anterior"
                        >
                            <ChevronLeft /> Anterior
                        </button>
                        <button 
                            disabled={currentStep === activeRecipe.steps.length - 1}
                            onClick={() => setCurrentStep(c => c + 1)}
                            className={`p-6 rounded-xl font-bold flex justify-center gap-2 shadow-md transition-transform active:scale-95 ${currentStep === activeRecipe.steps.length - 1 ? 'opacity-30' : btnPrimary}`}
                            aria-label="Siguiente paso"
                        >
                            Siguiente <ChevronRight />
                        </button>
                    </div>

                    {/* ACCESSIBLE BOTTOM VOICE BAR */}
                    <button 
                        onClick={toggleVoice}
                        className={`fixed bottom-0 left-0 right-0 py-8 flex flex-col items-center justify-center transition-colors duration-300 border-t-4 z-50
                            ${status === 'listening' 
                                ? 'bg-yellow-400 text-black border-red-500 animate-pulse' 
                                : settings.highContrast ? 'bg-gray-800 text-yellow-400 border-yellow-400' : 'bg-christmas-red text-white border-christmas-gold'
                            }`}
                        aria-label={status === 'listening' 
                            ? "Micrófono activado. Te estoy escuchando. Di un comando." 
                            : "Activar control por voz. Toca para hablar. Comandos disponibles: Siguiente, Anterior, Repetir, Temporizador, Salir."}
                        aria-live="assertive"
                        aria-pressed={status === 'listening'}
                    >
                         {status === 'listening' ? (
                             <>
                                <Mic size={40} className="animate-bounce" />
                                <span className="text-lg font-black tracking-widest mt-2 uppercase">TE ESCUCHO...</span>
                             </>
                         ) : (
                             <>
                                <div className="flex items-center gap-2">
                                    <Mic size={28} />
                                    <span className="text-2xl font-bold uppercase">Toca para hablar</span>
                                </div>
                                <span className="text-xs opacity-90 mt-2 font-medium">Di: "Siguiente", "Atrás", "Repetir", "Temporizador"</span>
                             </>
                         )}
                    </button>
                </div>
            )}

            {/* SETTINGS */}
            {view.type === 'SETTINGS' && (
                <div className="space-y-6">
                     <button onClick={goHome} className="flex items-center gap-2 opacity-70"><ChevronLeft /> Volver</button>
                     <h2 className={`${headingSize} font-bold`}>Configuración</h2>
                     <div className={`p-4 rounded-xl ${cardBg}`}>
                        <label className="flex items-center justify-between p-4 border-b border-gray-600/20 cursor-pointer">
                            <span>Alto Contraste</span>
                            <input type="checkbox" checked={settings.highContrast} onChange={e => setSettings({...settings, highContrast: e.target.checked})} className="w-6 h-6" />
                        </label>
                        <label className="flex items-center justify-between p-4 cursor-pointer">
                            <span>Voz activada</span>
                            <input type="checkbox" checked={settings.voiceEnabled} onChange={e => setSettings({...settings, voiceEnabled: e.target.checked})} className="w-6 h-6" />
                        </label>
                     </div>
                </div>
            )}
        </main>
    </div>
  );
}
