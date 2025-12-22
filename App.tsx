
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Category, Recipe, ViewState, AppSettings, AppStatus } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { 
  Mic, ChevronLeft, ChevronRight, Clock, Play, ShoppingCart, Settings as SettingsIcon, ChefHat, 
  Plus, X, Search, CheckCircle2, Users, Info, Sparkles, Share2, ListChecks, Brain
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
  const [menuIds, setMenuIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('christmas_menu');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [servings, setServings] = useState(4);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<AppStatus>('idle');

  useEffect(() => { localStorage.setItem('christmas_menu', JSON.stringify(menuIds)); }, [menuIds]);

  const speak = useCallback((text: string) => {
    if (!settings.voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    window.speechSynthesis.speak(utterance);
  }, [settings.voiceEnabled]);

  const startVoiceAssistance = () => {
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.onstart = () => setStatus('listening');
    recognition.onend = () => { if (status === 'listening') setStatus('idle'); };
    recognition.onresult = (e: any) => {
      const command = e.results[0][0].transcript.toLowerCase();
      handleVoiceCommand(command);
    };
    recognition.start();
  };

  const handleVoiceCommand = async (command: string) => {
    if (!activeRecipe) return;

    if (command.includes('siguiente')) {
      if (currentStep < activeRecipe.steps.length - 1) {
        const next = currentStep + 1;
        setCurrentStep(next);
        speak(`Paso ${next + 1}: ${activeRecipe.steps[next].description}`);
      }
    } else if (command.includes('anterior')) {
      if (currentStep > 0) {
        const prev = currentStep - 1;
        setCurrentStep(prev);
        speak(`Volvemos al paso ${prev + 1}: ${activeRecipe.steps[prev].description}`);
      }
    } else if (command.includes('repite')) {
      speak(activeRecipe.steps[currentStep].description);
    } else {
      setStatus('processing');
      const response = await generateCookingAssistance(activeRecipe, currentStep, command, servings);
      speak(response);
    }
  };

  const menuRecipes = useMemo(() => SAMPLE_RECIPES.filter(r => menuIds.includes(r.id)), [menuIds]);

  const filteredRecipes = useMemo(() => 
    SAMPLE_RECIPES.filter(r => 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.tags.some(t => t.includes(searchTerm.toLowerCase()))
    ), 
  [searchTerm]);

  const toggleMenuRecipe = (id: string) => {
    setMenuIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const bgColor = settings.highContrast ? 'bg-black' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const cardBg = settings.highContrast ? 'bg-gray-900 border-gray-700' : 'bg-white border-christmas-gold/20';

  if (showIntro) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
        <ChefHat size={120} className="mb-6 animate-bounce text-christmas-accent" />
        <h1 className="text-6xl font-serif font-bold mb-4 tracking-tight">Navidad en la Mesa</h1>
        <p className="text-xl mb-12 opacity-80 max-w-md font-light italic">Asistente Culinario con IA para tus cenas más especiales.</p>
        <button onClick={() => { setShowIntro(false); speak("Hola. Estoy listo para ayudarte a cocinar."); }} className="px-16 py-6 text-2xl font-bold rounded-2xl shadow-2xl bg-christmas-green text-white hover:scale-105 transition-transform border-b-8 border-green-900">Empezar a Cocinar</button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-colors duration-500`}>
      <header className={`p-4 flex justify-between items-center shadow-lg sticky top-0 z-40 ${settings.highContrast ? 'bg-gray-900' : 'bg-christmas-red text-white'}`}>
        <div onClick={() => setView({type: 'HOME'})} className="flex items-center gap-3 cursor-pointer">
          <ChefHat size={28}/>
          <span className="font-serif font-bold text-2xl tracking-tighter hidden sm:inline">Navidad en la Mesa</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView({type: 'CART'})} className="p-3 rounded-xl hover:bg-white/10 relative">
            <ListChecks size={24}/>
            {menuIds.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-christmas-accent text-black text-[10px] font-black flex items-center justify-center rounded-full border-2 border-christmas-red">{menuIds.length}</span>}
          </button>
          <button onClick={() => setView({type: 'SETTINGS'})} className="p-3 rounded-xl hover:bg-white/10"><SettingsIcon size={24}/></button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-40">
        {view.type === 'HOME' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-christmas-gold" size={20} />
              <input 
                type="text"
                placeholder="Busca recetas o ingredientes..."
                className={`w-full pl-12 pr-4 py-5 rounded-3xl border-2 focus:ring-4 outline-none transition-all text-lg ${cardBg}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredRecipes.map(recipe => (
                <div key={recipe.id} className={`group rounded-[2rem] overflow-hidden border-2 transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col ${cardBg}`}>
                  <div className="h-56 relative overflow-hidden cursor-pointer" onClick={() => { setActiveRecipe(recipe); setView({type: 'RECIPE', recipeId: recipe.id}); }}>
                    <img src={recipe.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={recipe.title} />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <h3 className="font-bold font-serif text-2xl mb-4 leading-none">{recipe.title}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 opacity-60 text-xs font-bold">
                        <span className="flex items-center gap-1"><Clock size={14}/> {recipe.cookTimeMinutes} min</span>
                        <span className="flex items-center gap-1"><Info size={14}/> {recipe.difficulty}</span>
                      </div>
                      <button 
                        onClick={() => toggleMenuRecipe(recipe.id)}
                        className={`p-3 rounded-full transition-colors ${menuIds.includes(recipe.id) ? 'bg-christmas-green text-white' : 'bg-christmas-gold/10 text-christmas-gold'}`}
                      >
                        {menuIds.includes(recipe.id) ? <CheckCircle2 size={20}/> : <Plus size={20}/>}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view.type === 'RECIPE' && activeRecipe && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-black text-sm opacity-50 uppercase tracking-widest"><ChevronLeft size={16}/> Volver</button>
            <div className={`rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white ${cardBg}`}>
              <img src={activeRecipe.imageUrl} className="w-full h-80 object-cover" alt={activeRecipe.title} />
              <div className="p-10 space-y-12">
                <h1 className="text-5xl font-serif font-bold text-christmas-red">{activeRecipe.title}</h1>
                <div className="flex justify-between items-center bg-christmas-gold/5 p-8 rounded-[2rem] border-2 border-christmas-gold/10">
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-widest text-christmas-gold flex items-center gap-2"><Users size={16}/> Comensales</h4>
                  </div>
                  <div className="flex items-center gap-6">
                    <button onClick={() => setServings(Math.max(1, servings - 1))} className="w-12 h-12 rounded-full bg-white border-2 border-christmas-gold font-bold text-2xl">-</button>
                    <span className="text-4xl font-black">{servings}</span>
                    <button onClick={() => setServings(servings + 1)} className="w-12 h-12 rounded-full bg-white border-2 border-christmas-gold font-bold text-2xl">+</button>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-16">
                  <section>
                    <h3 className="text-3xl font-serif font-bold mb-8 border-b-8 border-christmas-red inline-block">Ingredientes</h3>
                    <ul className="space-y-6">
                      {activeRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span className="text-xl font-medium">{ing.name}</span>
                          <span className="font-black text-christmas-red text-xl">{(ing.amount * (servings / activeRecipe.servingsBase)).toFixed(1).replace('.0', '')} {ing.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <button onClick={() => { setView({type: 'COOKING', recipeId: activeRecipe.id}); setCurrentStep(0); speak(`Paso uno: ${activeRecipe.steps[0].description}`); }} className="w-full py-8 text-3xl font-black rounded-3xl bg-christmas-green text-white shadow-2xl flex items-center justify-center gap-4">
                    <Play fill="white" size={32}/> MODO COCINA
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view.type === 'COOKING' && activeRecipe && (
          <div className="flex flex-col gap-8 max-w-3xl mx-auto h-[70vh] justify-center items-center text-center">
            <div className="w-full flex justify-between items-center">
              <span className="px-6 py-2 rounded-full bg-christmas-gold/10 text-christmas-gold font-black text-xs tracking-widest uppercase">Paso {currentStep + 1} de {activeRecipe.steps.length}</span>
              <button onClick={() => setView({type: 'RECIPE', recipeId: activeRecipe.id})} className="p-2 bg-black/5 rounded-lg"><X size={20}/></button>
            </div>
            <div className={`w-full p-12 md:p-20 rounded-[4rem] border-[12px] shadow-2xl relative ${settings.highContrast ? 'bg-black border-christmas-accent text-white' : 'bg-white border-christmas-green'}`}>
              <p className="text-4xl md:text-5xl font-serif font-bold leading-tight">
                {activeRecipe.steps[currentStep].description}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
              <button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} className="py-8 rounded-3xl border-4 font-black text-xl disabled:opacity-20">ATRÁS</button>
              <button disabled={currentStep === activeRecipe.steps.length - 1} onClick={() => setCurrentStep(prev => prev + 1)} className="py-8 rounded-3xl bg-christmas-green text-white font-black text-xl disabled:opacity-20">SIGUIENTE</button>
            </div>
            <div className="fixed bottom-0 left-0 right-0 p-6 md:p-12 z-50 flex justify-center">
              <button 
                onClick={startVoiceAssistance}
                className={`w-full max-w-xl py-12 rounded-[3rem] flex flex-col items-center justify-center shadow-2xl transition-all border-4 ${status === 'listening' ? 'bg-christmas-accent border-white animate-pulse' : status === 'processing' ? 'bg-christmas-gold border-white' : 'bg-christmas-red text-white border-christmas-gold'}`}
              >
                {status === 'processing' ? <Brain size={48} className="mb-2 animate-bounce" /> : <Mic size={48} className="mb-2" />}
                <span className="text-2xl font-black uppercase tracking-tighter">
                  {status === 'listening' ? 'Te escucho...' : status === 'processing' ? 'Consultando al Chef...' : 'Preguntar al Asistente'}
                </span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
