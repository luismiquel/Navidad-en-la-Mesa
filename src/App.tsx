
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category, Recipe, ViewState, AppSettings } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { Mic, ChevronLeft, ChevronRight, Clock, Play, Pause, RotateCcw, Home, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, Volume2, VolumeX } from 'lucide-react';

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
        utterance.rate = 0.95; 
        
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
    // Stop speaking if listening starts
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
            // Only set to idle if we aren't transitioning to speaking/processing
            if (status === 'listening') setStatus('idle');
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            handleVoiceCommand(transcript);
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

      // 1. GLOBAL COMMANDS (Exit)
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
                  // The useEffect will handle the reading
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
          if (command.includes('repetir') || command.includes('repite') || command.includes('qué') || command.includes('lee')) {
              const textToRead = recipe.steps[step].description;
              speakRobust(`Repito: ${textToRead}`);
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
                      // If timer was at 0 (or finished), reset it to full time
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
          // 3. HOME/MENU COMMANDS
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
    // Explicitly ask what to cook upon entry
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

        // Prepare timer if exists
        if (stepData.timerMinutes && timerSeconds === 0 && !isTimerRunning) {
             setTimerSeconds(stepData.timerMinutes * 60);
        }

        // Determine navigation direction for natural phrasing
        const direction = currentStep > previousStepRef.current ? 'next' : currentStep < previousStepRef.current ? 'prev' : 'init';
        
        // Skip if it's just a re-render of the same step without nav
        if (hasSpokenInit.current && direction === 'init' && currentStep === previousStepRef.current) return;

        hasSpokenInit.current = true;
        previousStepRef.current = currentStep;

        let phrase = "";
        if (direction === 'init') {
            phrase = `Empezamos con ${recipe.title}. Paso 1.`;
        } else if (direction === 'next') {
            phrase = `Avanzando al paso ${currentStep + 1}.`;
        } else if (direction === 'prev') {
            phrase = `Volviendo al paso ${currentStep + 1}.`;
        }

        let fullText = `${phrase} ${stepData.description}`;
        if (stepData.timerMinutes) {
            fullText += ` Tiempo sugerido: ${stepData.timerMinutes} minutos. Di "temporizador" para iniciar.`;
        }

        // Small delay to allow UI update before speaking
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
        hasSpokenInit.current = false; // Reset for auto-read
        setView({ type: 'COOKING', recipeId });
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

  // --- STYLES & CLASSES (Restored Tailwind) ---
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
            <button onClick={() => setView({ type: 'SETTINGS' })} className="p-2 rounded hover:bg-white/10">
                <SettingsIcon />
            </button>
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
                                <h3 className={`text-xl font-bold font-serif mb-2 ${accentText}`}>Ingredientes</h3>
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

            {/* COOKING MODE */}
            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col h-[calc(100vh-80px)]">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => selectRecipe(activeRecipe.id)} className="text-sm opacity-70 flex items-center gap-1"><VolumeX size={16} /> Salir</button>
                        <span className="font-bold truncate px-2">{activeRecipe.title}</span>
                        <span className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{currentStep + 1}/{activeRecipe.steps.length}</span>
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
                    <div className="grid grid-cols-2 gap-4 mb-24">
                        <button 
                            disabled={currentStep === 0}
                            onClick={() => setCurrentStep(c => c - 1)}
                            className={`p-4 rounded-xl font-bold flex justify-center gap-2 ${currentStep === 0 ? 'opacity-30' : 'bg-gray-200 text-gray-800'}`}
                        >
                            <ChevronLeft /> Anterior
                        </button>
                        <button 
                            disabled={currentStep === activeRecipe.steps.length - 1}
                            onClick={() => setCurrentStep(c => c + 1)}
                            className={`p-4 rounded-xl font-bold flex justify-center gap-2 ${currentStep === activeRecipe.steps.length - 1 ? 'opacity-30' : btnPrimary}`}
                        >
                            Siguiente <ChevronRight />
                        </button>
                    </div>

                    {/* ACCESSIBLE BOTTOM VOICE BAR */}
                    <button 
                        onClick={toggleVoice}
                        className={`fixed bottom-0 left-0 right-0 py-6 flex flex-col items-center justify-center transition-colors duration-300 border-t-4 z-50
                            ${status === 'listening' 
                                ? 'bg-yellow-400 text-black border-red-500 animate-pulse' 
                                : settings.highContrast ? 'bg-gray-800 text-yellow-400 border-yellow-400' : 'bg-christmas-red text-white border-christmas-gold'
                            }`}
                    >
                         {status === 'listening' ? (
                             <>
                                <Mic size={40} className="animate-bounce" />
                                <span className="text-lg font-black tracking-widest mt-1 uppercase">TE ESCUCHO...</span>
                             </>
                         ) : (
                             <>
                                <div className="flex items-center gap-2">
                                    <Mic size={24} />
                                    <span className="text-xl font-bold uppercase">Toca para hablar</span>
                                </div>
                                <span className="text-xs opacity-80 mt-1">Di: "Siguiente", "Atrás", "Repetir", "Temporizador"</span>
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
