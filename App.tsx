
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category, Recipe, ViewState, AppSettings } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { Mic, ChevronLeft, ChevronRight, Clock, Play, Pause, RotateCcw, Home, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, Volume2, VolumeX } from 'lucide-react';

// Polyfill para SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  // Estado para la pantalla de introducción
  const [showIntro, setShowIntro] = useState(true);

  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [settings, setSettings] = useState<AppSettings>({
    highContrast: false,
    fontSizeMultiplier: 1,
    voiceEnabled: true,
  });

  // Cooking Mode State
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  
  // Timer State within Cooking Mode
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const previousStepRef = useRef(0);
  const hasSpokenInit = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // --- AUDIO HELPERS ---

  const speakRobust = useCallback((text: string, onEnd?: () => void) => {
    if (!settings.voiceEnabled) {
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9; // Un poco más lento para claridad
    
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
  }, [settings.voiceEnabled]);

  const playFeedbackSound = (type: 'start' | 'end') => {
      // Simple visual/haptic feedback simulation logic implies auditory cues
      // In a real app, we'd play a beep here.
      // For now, we rely on TTS "Te escucho" for start.
  };

  // --- VOICE RECOGNITION ---

  const startListening = () => {
    if (!SpeechRecognition) {
        alert("Tu navegador no soporta reconocimiento de voz.");
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
            playFeedbackSound('start');
        };

        recognition.onend = () => {
            isListeningRef.current = false;
            if (status === 'listening') setStatus('idle');
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
      if (command.includes('siguiente') || command.includes('avanza') || command.includes('próximo')) {
          if (activeRecipe && currentStep < activeRecipe.steps.length - 1) {
              setCurrentStep(prev => prev + 1);
          } else {
              speakRobust("Ya estás en el último paso.");
          }
      } else if (command.includes('anterior') || command.includes('atrás') || command.includes('vuelve')) {
          if (currentStep > 0) {
              setCurrentStep(prev => prev - 1);
          } else {
              speakRobust("Estás en el primer paso.");
          }
      } else if (command.includes('repetir') || command.includes('repite') || command.includes('qué')) {
          // Trigger effect manually or logic
          speakRobust(activeRecipe?.steps[currentStep].description || "");
      } else if (command.includes('salir') || command.includes('terminar')) {
          goHome();
          speakRobust("Saliendo de la cocina.");
      } else if (command.includes('temporizador') || command.includes('tiempo')) {
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
    // Cancelar cualquier audio pendiente y dar tiempo a la UI para renderizar
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
        const recipe = activeRecipe;
        const step = recipe.steps[currentStep];

        // Set Timer if exists
        if (step.timerMinutes) {
            setTimeLeft(step.timerMinutes * 60);
            setTimerActive(false);
        } else {
            setTimeLeft(0);
        }

        if (!hasSpokenInit.current) {
            hasSpokenInit.current = true;
            const intro = `Empezamos con ${recipe.title}. Paso 1. ${step.description}`;
             speakRobust(intro, () => setStatus('idle'));
             return; 
        }

        if (hasSpokenInit.current) {
            const direction = currentStep > previousStepRef.current ? 'next' : currentStep < previousStepRef.current ? 'prev' : 'same';
            if (direction === 'same' && currentStep === previousStepRef.current) return;

            let introPhrase = `Paso ${currentStep + 1}.`;
            if (direction === 'next') introPhrase = `Avanzando al paso ${currentStep + 1}.`;
            else if (direction === 'prev') introPhrase = `Volviendo al paso ${currentStep + 1}.`;

            previousStepRef.current = currentStep;

            setTimeout(() => {
                let fullText = `${introPhrase} ${step.description}`;
                if (step.timerMinutes) fullText += ` Tiempo sugerido: ${step.timerMinutes} minutos.`;
                speakRobust(fullText, () => setStatus('idle'));
            }, 300);
        }
    }
  }, [currentStep, view.type, activeRecipe, speakRobust]);

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
      const q = query || "Explícame este paso con más detalle";
      try {
        const text = await generateCookingAssistance(activeRecipe, currentStep, q);
        speakRobust(text, () => setStatus('idle'));
      } catch (e) {
        speakRobust("El asistente no está disponible ahora.", () => setStatus('idle'));
      }
  };

  const updateStatus = (s: any) => setStatus(s);
  const toggleTimer = () => setTimerActive(!timerActive);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- RENDER HELPERS ---

  // Common styles based on settings
  const baseTextSize = settings.fontSizeMultiplier === 1.5 ? 'text-xl' : settings.fontSizeMultiplier === 1.25 ? 'text-lg' : 'text-base';
  const headingSize = settings.fontSizeMultiplier === 1.5 ? 'text-4xl' : settings.fontSizeMultiplier === 1.25 ? 'text-3xl' : 'text-2xl';
  const bgColor = settings.highContrast ? 'bg-gray-900' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-gray-800';
  const accentColor = settings.highContrast ? 'text-yellow-400' : 'text-christmas-red';
  const cardBg = settings.highContrast ? 'bg-gray-800 border-gray-700' : 'bg-white border-christmas-gold/30';

  if (showIntro) {
      return (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
              <ChefHat size={80} className="mb-6 animate-bounce" />
              <h1 className="text-5xl font-serif font-bold mb-4">Navidad en la Mesa</h1>
              <p className="text-xl mb-12 opacity-90">Tu asistente culinario accesible y festivo.</p>
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
            <div onClick={goHome} className="flex items-center gap-2 cursor-pointer font-serif font-bold text-xl">
                <ChefHat /> Navidad en la Mesa
            </div>
            <button onClick={() => setView({ type: 'SETTINGS' })} className="p-2 rounded hover:bg-white/10">
                <SettingsIcon />
            </button>
        </header>

        <main className={`flex-1 w-full max-w-3xl mx-auto p-4 ${baseTextSize}`}>
            
            {/* HOME VIEW */}
            {view.type === 'HOME' && (
                <div className="space-y-6">
                    <div className="text-center py-8">
                        <h1 className={`${headingSize} font-serif font-bold ${accentColor} mb-2`}>¿Qué cocinamos hoy?</h1>
                        <p className="opacity-75">Selecciona una categoría para empezar</p>
                    </div>
                    <div className="grid gap-4">
                        {Object.values(Category).map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => selectCategory(cat)}
                                className={`w-full p-6 text-left text-xl font-bold rounded-xl border-2 transition-all transform hover:-translate-y-1 shadow-sm
                                    ${settings.highContrast 
                                        ? 'bg-gray-800 border-yellow-400 text-yellow-400 hover:bg-gray-700' 
                                        : 'bg-white border-christmas-gold text-christmas-green hover:border-christmas-red hover:shadow-md'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* CATEGORY VIEW */}
            {view.type === 'CATEGORY' && (
                <div className="space-y-4">
                    <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100 mb-4">
                        <ChevronLeft /> Volver al inicio
                    </button>
                    <h2 className={`${headingSize} font-serif font-bold ${accentColor} border-b-2 border-christmas-gold/20 pb-2`}>{view.category}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {SAMPLE_RECIPES.filter(r => r.category === view.category).map(recipe => (
                            <div 
                                key={recipe.id} 
                                onClick={() => selectRecipe(recipe.id)} 
                                className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:shadow-lg ${cardBg}`}
                            >
                                <div className="h-40 overflow-hidden relative">
                                    <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover transition-transform hover:scale-110 duration-500" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                         <div className="flex items-center gap-1 text-white text-xs font-bold">
                                            <Clock size={12} /> {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                                         </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold font-serif text-lg leading-tight mb-1">{recipe.title}</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full ${settings.highContrast ? 'bg-white text-black' : 'bg-christmas-green/10 text-christmas-green'}`}>
                                        {recipe.difficulty}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* RECIPE DETAIL VIEW */}
            {view.type === 'RECIPE' && activeRecipe && (
                <div className="space-y-6 pb-20">
                    <button onClick={() => selectCategory(activeRecipe.category)} className="flex items-center gap-2 opacity-70 hover:opacity-100">
                        <ChevronLeft /> Volver a {activeRecipe.category}
                    </button>
                    
                    <div className={`rounded-2xl overflow-hidden shadow-xl ${cardBg}`}>
                        <div className="relative h-64 md:h-80">
                            <img src={activeRecipe.imageUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                                <h1 className="text-3xl md:text-4xl font-serif font-bold text-white shadow-black drop-shadow-lg">{activeRecipe.title}</h1>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <p className="text-lg opacity-80 italic">{activeRecipe.description}</p>
                            
                            <div className="grid grid-cols-3 gap-2 text-center py-4 border-y border-gray-200 dark:border-gray-700">
                                <div>
                                    <span className="block text-xs uppercase tracking-wider opacity-60">Prep</span>
                                    <span className="font-bold text-lg">{activeRecipe.prepTimeMinutes} m</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider opacity-60">Cocina</span>
                                    <span className="font-bold text-lg">{activeRecipe.cookTimeMinutes} m</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider opacity-60">Raciones</span>
                                    <span className="font-bold text-lg">{activeRecipe.servingsBase}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className={`text-xl font-bold font-serif mb-4 flex items-center gap-2 ${accentColor}`}>
                                    <ShoppingCart size={20} /> Ingredientes
                                </h3>
                                <ul className="space-y-2">
                                    {activeRecipe.ingredients.map((ing, idx) => (
                                        <li key={idx} className="flex justify-between items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <span>{ing.name}</span>
                                            <span className="font-bold">{ing.amount} {ing.unit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button 
                                onClick={() => startCooking(activeRecipe.id)}
                                className={`w-full py-4 text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95
                                    ${settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-green text-white hover:bg-green-800'}`}
                            >
                                <Play fill="currentColor" /> ¡Empezar a Cocinar!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* COOKING MODE VIEW */}
            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col h-[calc(100vh-80px)]">
                    {/* Header compact */}
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => selectRecipe(activeRecipe.id)} className="text-sm opacity-70 hover:opacity-100 flex items-center gap-1">
                            <VolumeX size={16} /> Salir
                        </button>
                        <span className="font-serif font-bold truncate px-2">{activeRecipe.title}</span>
                        <div className="text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                            {currentStep + 1} / {activeRecipe.steps.length}
                        </div>
                    </div>
                    
                    {/* Main Step Card */}
                    <div className={`flex-1 flex flex-col justify-center items-center p-6 text-center rounded-2xl shadow-inner border-4 mb-4 relative overflow-hidden
                        ${settings.highContrast ? 'bg-black border-yellow-400' : 'bg-white border-christmas-green'}`}>
                        
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ChefHat size={150} />
                        </div>

                        <p className={`font-medium mb-6 ${headingSize} ${settings.highContrast ? 'text-yellow-300' : 'text-gray-800'}`}>
                            {activeRecipe.steps[currentStep].description}
                        </p>

                        {/* Timer Display */}
                        {activeRecipe.steps[currentStep].timerMinutes && (
                            <div className={`mt-4 p-4 rounded-xl w-full max-w-xs transition-colors cursor-pointer
                                ${timerActive ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}
                            `} onClick={toggleTimer}>
                                <div className="flex items-center justify-center gap-2 text-3xl font-mono font-bold">
                                    <Clock /> {formatTime(timeLeft)}
                                </div>
                                <div className="text-sm uppercase tracking-widest mt-1 font-bold">
                                    {timerActive ? 'Corriendo...' : 'Tocar para iniciar'}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Navigation Controls (Manual) */}
                    <div className="grid grid-cols-2 gap-4 mb-24">
                         <button 
                            disabled={currentStep === 0} 
                            onClick={() => setCurrentStep(c => Math.max(0, c - 1))}
                            className={`p-6 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow transition-all active:scale-95
                                ${currentStep === 0 ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
                        >
                            <ChevronLeft size={24} /> Anterior
                        </button>
                        <button 
                            disabled={currentStep === activeRecipe.steps.length - 1} 
                            onClick={() => setCurrentStep(c => Math.min(activeRecipe.steps.length - 1, c + 1))}
                            className={`p-6 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow transition-all active:scale-95
                                ${currentStep === activeRecipe.steps.length - 1 ? 'bg-christmas-green text-white' : 'bg-christmas-green text-white hover:bg-green-800'}`}
                        >
                            Siguiente <ChevronRight size={24} />
                        </button>
                    </div>

                    {/* ACCESSIBLE BOTTOM VOICE BAR */}
                    <div className="fixed bottom-0 left-0 right-0 p-0 z-50">
                        <button 
                            onClick={toggleVoice}
                            className={`w-full py-8 flex flex-col items-center justify-center transition-colors duration-300 border-t-4
                                ${status === 'listening' 
                                    ? 'bg-christmas-accent border-christmas-red text-black animate-pulse' 
                                    : settings.highContrast ? 'bg-yellow-400 text-black border-white' : 'bg-christmas-red text-white border-christmas-gold'
                                }`}
                            aria-label={status === 'listening' ? "Escuchando. Di un comando." : "Activar micrófono"}
                        >
                             {status === 'listening' ? (
                                 <>
                                    <Mic size={48} className="animate-bounce" />
                                    <span className="text-xl font-black tracking-widest mt-2 uppercase">TE ESCUCHO...</span>
                                 </>
                             ) : (
                                 <>
                                    <div className="flex items-center gap-3">
                                        <Mic size={32} />
                                        <span className="text-2xl font-bold uppercase tracking-wide">Toca para hablar</span>
                                    </div>
                                    <span className="text-xs opacity-80 mt-1">Di "Siguiente", "Atrás", "Repetir"...</span>
                                 </>
                             )}
                        </button>
                    </div>

                </div>
            )}
            
            {/* SETTINGS VIEW */}
            {view.type === 'SETTINGS' && (
                <div className="space-y-6">
                     <button onClick={goHome} className="flex items-center gap-2 opacity-70 hover:opacity-100">
                        <ChevronLeft /> Volver
                    </button>
                    <h2 className={`${headingSize} font-serif font-bold`}>Configuración</h2>
                    
                    <div className={`p-6 rounded-xl shadow-lg space-y-6 ${cardBg}`}>
                        <div className="flex items-center justify-between p-2">
                            <span className="text-lg font-medium">Alto Contraste / Modo Oscuro</span>
                            <button 
                                onClick={() => setSettings({...settings, highContrast: !settings.highContrast})}
                                className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-yellow-400' : 'bg-gray-300'}`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform ${settings.highContrast ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <span className="text-lg font-medium">Voz y Lectura Automática</span>
                            <button 
                                onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})}
                                className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.voiceEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform ${settings.voiceEnabled ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <span className="text-lg font-medium block mb-4">Tamaño de letra</span>
                            <div className="flex gap-2">
                                {[1, 1.25, 1.5].map((size) => (
                                    <button 
                                        key={size}
                                        onClick={() => setSettings({...settings, fontSizeMultiplier: size})}
                                        className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all
                                            ${settings.fontSizeMultiplier === size 
                                                ? (settings.highContrast ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-christmas-red text-white border-christmas-red')
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
        </main>
    </div>
  );
}
