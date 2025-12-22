
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Category, Recipe, ViewState, AppSettings, Ingredient, AppStatus } from './types';
import { SAMPLE_RECIPES } from './data';
import { generateCookingAssistance } from './services/geminiService';
import { 
  Mic, ChevronLeft, ChevronRight, Clock, Play, ShoppingCart, Heart, Settings as SettingsIcon, ChefHat, 
  Plus, Trash2, X, Search, CheckCircle2, Users, Timer, Info, Sparkles, Share2, ListChecks
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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [preppedIngredients, setPreppedIngredients] = useState<Record<string, boolean>>({});

  useEffect(() => { localStorage.setItem('christmas_menu', JSON.stringify(menuIds)); }, [menuIds]);

  const speakRobust = useCallback((text: string) => {
    if (!settings.voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.onend = () => setStatus('idle');
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

  const menuRecipes = useMemo(() => 
    SAMPLE_RECIPES.filter(r => menuIds.includes(r.id)), 
  [menuIds]);

  const aggregatedIngredients = useMemo(() => {
    const agg: Record<string, { amount: number, unit: string }> = {};
    menuRecipes.forEach(recipe => {
      const ratio = servings / recipe.servingsBase;
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase();
        if (agg[key]) agg[key].amount += ing.amount * ratio;
        else agg[key] = { amount: ing.amount * ratio, unit: ing.unit };
      });
    });
    return Object.entries(agg).map(([name, data]) => {
      // Conversión inteligente para la lista de compra
      let amt = data.amount;
      let unit = data.unit;
      if (unit === 'g' && amt >= 1000) { amt /= 1000; unit = 'kg'; }
      if (unit === 'ml' && amt >= 1000) { amt /= 1000; unit = 'L'; }
      return { name, amount: amt.toFixed(2).replace('.00', ''), unit };
    });
  }, [menuRecipes, servings]);

  const filteredRecipes = useMemo(() => 
    SAMPLE_RECIPES.filter(r => 
      (r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.tags.some(t => t.includes(searchTerm.toLowerCase()))) &&
      (activeFilter ? r.tags.includes(activeFilter) : true)
    ), 
  [searchTerm, activeFilter]);

  const shareViaWhatsApp = () => {
    const text = `🎄 *Mi Lista de Compra Navidela* 🎄\n\n` + 
      aggregatedIngredients.map(i => `- ${i.name}: ${i.amount} ${i.unit}`).join('\n') +
      `\n\nGenerado con Navidad en la Mesa 🎁`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const toggleMenuRecipe = (id: string) => {
    setMenuIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- UI COMPONENTS ---
  const bgColor = settings.highContrast ? 'bg-black' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const cardBg = settings.highContrast ? 'bg-gray-900 border-gray-700' : 'bg-white border-christmas-gold/20';

  if (showIntro) {
      return (
          <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center ${settings.highContrast ? 'bg-black' : 'bg-christmas-red'} text-white`}>
              <ChefHat size={120} className="mb-6 animate-bounce text-christmas-accent" />
              <h1 className="text-6xl font-serif font-bold mb-4 tracking-tight">Navidad en la Mesa</h1>
              <p className="text-xl mb-12 opacity-80 max-w-md font-light">Software Local. Privacidad Total. Sabor Real.</p>
              <button onClick={() => { setShowIntro(false); speakRobust("Hola cocinero."); }} className="px-16 py-6 text-2xl font-bold rounded-2xl shadow-2xl bg-christmas-green text-white hover:scale-105 transition-transform border-b-8 border-green-900 active:translate-y-1 active:border-b-4">Entrar a la Cocina</button>
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
                <div className="space-y-8 animate-in fade-in duration-700">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-christmas-gold" size={20} />
                            <input 
                                type="text"
                                placeholder="Busca platos, ingredientes..."
                                className={`w-full pl-12 pr-4 py-5 rounded-3xl border-2 focus:ring-4 outline-none transition-all text-lg ${cardBg}`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                        {['tradicional', 'vegano', 'marisco', 'rápido', 'infantil'].map(tag => (
                            <button key={tag} onClick={() => setActiveFilter(activeFilter === tag ? null : tag)} className={`px-6 py-2 rounded-2xl text-xs font-black uppercase transition-all border-2 ${activeFilter === tag ? 'bg-christmas-red border-christmas-red text-white' : 'bg-white border-christmas-gold/30 text-christmas-gold'}`}>{tag}</button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredRecipes.map(recipe => (
                            <div key={recipe.id} className={`group rounded-[2rem] overflow-hidden border-2 transition-all hover:-translate-y-2 hover:shadow-2xl flex flex-col ${cardBg}`}>
                                <div className="h-56 relative overflow-hidden" onClick={() => { setActiveRecipe(recipe); setView({type: 'RECIPE', recipeId: recipe.id}); }}>
                                  <img src={recipe.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={recipe.title} />
                                  <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase">{recipe.category}</span>
                                  </div>
                                </div>
                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <h3 className="font-bold font-serif text-2xl mb-4 leading-none">{recipe.title}</h3>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 opacity-60 text-xs font-bold">
                                        <span className="flex items-center gap-1"><Clock size={14}/> {recipe.cookTimeMinutes} min</span>
                                        <span className="flex items-center gap-1"><Info size={14}/> {recipe.difficulty}</span>
                                      </div>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); toggleMenuRecipe(recipe.id); }}
                                        className={`p-3 rounded-full transition-colors ${menuIds.includes(recipe.id) ? 'bg-christmas-green text-white' : 'bg-christmas-gold/10 text-christmas-gold hover:bg-christmas-gold/20'}`}
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
                    <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-black text-sm opacity-50 hover:opacity-100 transition-opacity uppercase tracking-widest"><ChevronLeft size={16}/> Volver</button>
                    
                    <div className={`rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white ${cardBg}`}>
                        <div className="h-96 relative">
                          <img src={activeRecipe.imageUrl} className="w-full h-full object-cover" alt={activeRecipe.title} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end p-10">
                            <div>
                              <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-2 tracking-tighter">{activeRecipe.title}</h1>
                              <p className="text-white/70 text-lg max-w-xl italic">{activeRecipe.description}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-10 space-y-12">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-christmas-gold/5 p-8 rounded-[2rem] border-2 border-christmas-gold/10">
                                <div>
                                  <h4 className="font-black text-xs uppercase tracking-widest text-christmas-gold mb-2 flex items-center gap-2"><Users size={16}/> Comensales</h4>
                                  <p className="text-sm opacity-60 font-medium">Las cantidades se ajustarán en tiempo real.</p>
                                </div>
                                <div className="flex items-center gap-6">
                                  <button onClick={() => setServings(Math.max(1, servings - 1))} className="w-14 h-14 rounded-full bg-white border-4 border-christmas-gold flex items-center justify-center font-bold text-3xl hover:bg-christmas-gold hover:text-white transition-all">-</button>
                                  <span className="text-5xl font-black text-christmas-red min-w-[3rem] text-center">{servings}</span>
                                  <button onClick={() => setServings(servings + 1)} className="w-14 h-14 rounded-full bg-white border-4 border-christmas-gold flex items-center justify-center font-bold text-3xl hover:bg-christmas-gold hover:text-white transition-all">+</button>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-16">
                                <section>
                                    <h3 className="text-3xl font-serif font-bold mb-8 border-b-8 border-christmas-red inline-block">Ingredientes</h3>
                                    <ul className="space-y-6">
                                        {activeRecipe.ingredients.map((ing, i) => (
                                            <li key={i} className="flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                  <div className="w-2 h-2 rounded-full bg-christmas-gold" />
                                                  <span className="text-xl font-medium">{ing.name}</span>
                                                </div>
                                                <span className="font-black text-christmas-red text-xl">{(ing.amount * (servings / activeRecipe.servingsBase)).toFixed(1).replace('.0', '')} {ing.unit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section className="space-y-8">
                                    <div className="bg-christmas-red/5 p-8 rounded-[2.5rem] space-y-6 border-2 border-christmas-red/10">
                                      <h3 className="font-black text-xs uppercase tracking-widest text-christmas-red flex items-center gap-2"><Timer size={18}/> Ficha Técnica</h3>
                                      <div className="space-y-4">
                                        <div className="flex justify-between text-lg"><span>Dificultad</span> <b className="uppercase">{activeRecipe.difficulty}</b></div>
                                        <div className="flex justify-between text-lg"><span>Preparación</span> <b>{activeRecipe.prepTimeMinutes} min</b></div>
                                        <div className="flex justify-between text-lg"><span>Cocción</span> <b>{activeRecipe.cookTimeMinutes} min</b></div>
                                      </div>
                                    </div>
                                    <button onClick={() => { setView({type: 'COOKING', recipeId: activeRecipe.id}); setCurrentStep(0); speakRobust(`Comenzamos ${activeRecipe.title}. ${activeRecipe.steps[0].description}`); }} className="w-full py-8 text-3xl font-black rounded-3xl bg-christmas-green text-white shadow-2xl hover:scale-[1.03] transition-all flex items-center justify-center gap-4 border-b-8 border-green-900">
                                      <Play fill="white" size={32}/> MODO COCINA
                                    </button>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view.type === 'CART' && (
                <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                    <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-black text-sm opacity-50 uppercase tracking-widest"><ChevronLeft size={16}/> Seguir Navegando</button>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <h2 className={`text-5xl font-serif font-bold ${settings.highContrast ? 'text-white' : 'text-christmas-red'}`}>Mi Menú Navideño</h2>
                        <div className="flex gap-3 w-full md:w-auto">
                          <button onClick={shareViaWhatsApp} className="flex-1 md:flex-none px-6 py-4 bg-green-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"><Share2 size={20}/> Compartir</button>
                          <button onClick={() => setMenuIds([])} className="px-6 py-4 bg-red-100 text-red-600 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-200"><Trash2 size={20}/></button>
                        </div>
                    </div>

                    {menuRecipes.length === 0 ? (
                        <div className={`p-20 text-center rounded-[3rem] border-4 border-dashed border-christmas-gold/30 ${cardBg}`}>
                          <Sparkles size={64} className="mx-auto mb-6 text-christmas-gold/40" />
                          <p className="text-2xl font-medium opacity-50">Tu menú está vacío. Añade algunas recetas para empezar.</p>
                        </div>
                    ) : (
                        <div className="grid gap-8">
                            <div className={`p-8 rounded-[2.5rem] shadow-xl ${cardBg}`}>
                              <h3 className="text-2xl font-serif font-bold mb-6 flex items-center gap-3"><ShoppingCart className="text-christmas-gold"/> Ingredientes Unificados</h3>
                              <div className="grid sm:grid-cols-2 gap-4">
                                {aggregatedIngredients.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-4 bg-black/5 rounded-2xl hover:bg-black/10 transition-colors">
                                    <span className="font-medium text-lg capitalize">{item.name}</span>
                                    <span className="font-black text-christmas-red">{item.amount} {item.unit}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {menuRecipes.map(r => (
                                <div key={r.id} className={`p-6 rounded-3xl border-2 flex items-center justify-between ${cardBg}`}>
                                  <span className="font-bold font-serif truncate pr-4">{r.title}</span>
                                  <button onClick={() => toggleMenuRecipe(r.id)} className="text-red-500 hover:scale-110 transition-transform"><X size={20}/></button>
                                </div>
                              ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view.type === 'COOKING' && activeRecipe && (
                <div className="flex flex-col gap-8 max-w-3xl mx-auto h-[65vh] justify-center items-center text-center">
                    <div className="w-full flex justify-between items-center mb-4">
                        <span className="px-6 py-2 rounded-full bg-christmas-gold/10 text-christmas-gold font-black text-xs tracking-widest uppercase">Paso {currentStep + 1} / {activeRecipe.steps.length}</span>
                        <div className="flex gap-4">
                           <div className="text-sm font-bold opacity-60 flex items-center gap-1"><Users size={16}/> {servings} pers.</div>
                           <button onClick={() => setView({type: 'RECIPE', recipeId: activeRecipe.id})} className="p-2 bg-black/5 rounded-lg hover:bg-black/10"><X size={20}/></button>
                        </div>
                    </div>

                    <div className={`w-full p-12 md:p-20 rounded-[4rem] border-[12px] shadow-2xl relative transition-all duration-500 overflow-hidden
                        ${settings.highContrast ? 'bg-black border-christmas-accent text-white' : 'bg-white border-christmas-green'}`}>
                        <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none transform rotate-12"><ChefHat size={300} /></div>
                        <p className="text-4xl md:text-6xl font-serif font-bold leading-tight tracking-tight animate-in fade-in slide-in-from-top-8">
                            {activeRecipe.steps[currentStep].description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
                        <button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} className="py-8 rounded-3xl border-4 font-black text-xl flex items-center justify-center gap-3 hover:bg-black/5 transition-all disabled:opacity-20 active:scale-95"><ChevronLeft size={28}/> ATRÁS</button>
                        <button disabled={currentStep === activeRecipe.steps.length - 1} onClick={() => setCurrentStep(prev => prev + 1)} className="py-8 rounded-3xl bg-christmas-green text-white font-black text-xl flex items-center justify-center gap-3 hover:opacity-90 transition-all border-b-8 border-green-900 disabled:opacity-20 active:translate-y-1 active:border-b-0">SIGUIENTE <ChevronRight size={28}/></button>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 p-6 md:p-12 z-50">
                      <button 
                        onClick={() => status === 'listening' ? null : startListening()}
                        className={`w-full max-w-xl mx-auto py-12 rounded-[3rem] flex flex-col items-center justify-center shadow-2xl transition-all border-4 relative overflow-hidden
                        ${status === 'listening' ? 'bg-christmas-accent border-white animate-pulse' : 'bg-christmas-red text-white border-christmas-gold'}`}
                      >
                          <div className="relative z-10 flex flex-col items-center">
                            <Mic size={status === 'listening' ? 64 : 48} className="mb-2" />
                            <span className="text-3xl font-black tracking-tighter uppercase">{status === 'listening' ? 'Dime tu duda...' : '¿Alguna duda?'}</span>
                            <span className="text-xs font-bold opacity-70 mt-1 uppercase tracking-widest">Control Local Sin Internet</span>
                          </div>
                          {status === 'listening' && <div className="absolute inset-0 bg-white/20 animate-ping" />}
                      </button>
                    </div>
                </div>
            )}
            
            {view.type === 'SETTINGS' && (
                <div className="max-w-2xl mx-auto space-y-8">
                  <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 opacity-50 font-bold uppercase text-xs tracking-widest"><ChevronLeft size={16}/> Volver</button>
                  <h2 className="text-5xl font-serif font-bold mb-8">Preferencias</h2>
                  <div className={`p-8 rounded-[2.5rem] shadow-xl space-y-12 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <div><h3 className="text-2xl font-bold mb-1">Alto Contraste</h3><p className="opacity-60 text-sm">Optimizado para lectura nocturna o visión reducida.</p></div>
                      <button onClick={() => setSettings({...settings, highContrast: !settings.highContrast})} className={`w-16 h-8 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-christmas-accent' : 'bg-gray-300'}`}><div className={`w-6 h-6 rounded-full bg-white transform transition-transform ${settings.highContrast ? 'translate-x-8' : ''}`} /></button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><h3 className="text-2xl font-bold mb-1">Asistente de Voz</h3><p className="opacity-60 text-sm">Escucha y dicta pasos de cocina.</p></div>
                      <button onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})} className={`w-16 h-8 rounded-full p-1 transition-colors ${settings.voiceEnabled ? 'bg-christmas-green' : 'bg-gray-300'}`}><div className={`w-6 h-6 rounded-full bg-white transform transition-transform ${settings.voiceEnabled ? 'translate-x-8' : ''}`} /></button>
                    </div>
                  </div>
                </div>
            )}
        </main>
    </div>
  );
}
