
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Category, Recipe, ViewState, AppSettings } from './types';
import { SAMPLE_RECIPES } from './data';
import { 
  ChevronLeft, Clock, Play, Settings as SettingsIcon, ChefHat, 
  Plus, X, Search, CheckCircle2, Users, Info, ListChecks, Type, Trash2, 
  Volume2, VolumeX, Eye, Moon, Sun
} from 'lucide-react';

export default function App() {
  // --- ESTADOS ---
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('nav_settings');
    return saved ? JSON.parse(saved) : {
      highContrast: false,
      fontSizeMultiplier: 1,
      voiceEnabled: true,
    };
  });

  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [menuIds, setMenuIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('christmas_menu');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [servings, setServings] = useState(4);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // --- PERSISTENCIA ---
  useEffect(() => { localStorage.setItem('christmas_menu', JSON.stringify(menuIds)); }, [menuIds]);
  useEffect(() => { localStorage.setItem('nav_settings', JSON.stringify(settings)); }, [settings]);

  // --- LÓGICA DE VOZ NATIVA (LOCAL) ---
  const speak = useCallback((text: string) => {
    if (!settings.voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
  }, [settings.voiceEnabled]);

  // --- FILTRADO LOCAL ---
  const filteredRecipes = useMemo(() => 
    SAMPLE_RECIPES.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory ? r.category === activeCategory : true;
      return matchesSearch && matchesCategory;
    }), 
  [searchTerm, activeCategory]);

  const toggleMenuRecipe = (id: string) => {
    setMenuIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const menuRecipes = useMemo(() => SAMPLE_RECIPES.filter(r => menuIds.includes(r.id)), [menuIds]);

  const shoppingList = useMemo(() => {
    const map = new Map<string, { amount: number, unit: string }>();
    menuRecipes.forEach(recipe => {
      const ratio = servings / recipe.servingsBase;
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        const current = map.get(key);
        if (current && current.unit === ing.unit) {
          map.set(key, { ...current, amount: current.amount + (ing.amount * ratio) });
        } else {
          map.set(key, { amount: ing.amount * ratio, unit: ing.unit });
        }
      });
    });
    return Array.from(map.entries());
  }, [menuRecipes, servings]);

  // --- ESTILOS DINÁMICOS ---
  const baseFontSize = 16 * settings.fontSizeMultiplier;
  const bgColor = settings.highContrast ? 'bg-black' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const cardBg = settings.highContrast ? 'bg-zinc-900 border-2 border-yellow-400' : 'bg-white border-christmas-gold/20';
  const accentColor = settings.highContrast ? 'text-yellow-400' : 'text-christmas-red';
  const btnSecondary = settings.highContrast ? 'border-2 border-yellow-400 text-yellow-400 bg-black' : 'bg-christmas-green text-white';

  // --- COMPONENTES AUXILIARES ---
  const Copyright = () => (
    <div className="py-12 mt-12 border-t border-christmas-gold/10 text-center opacity-40">
      <p className="font-serif italic text-sm mb-1">Navidad en la Mesa © 2024</p>
      <p className="font-bold text-[10px] uppercase tracking-[0.2em]">Creada por Luis Miguel García de las Morenas</p>
    </div>
  );

  if (showIntro) {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 text-center transition-colors duration-700 ${settings.highContrast ? 'bg-black text-yellow-400' : 'bg-christmas-red text-white'}`} style={{ fontSize: `${baseFontSize}px` }}>
        <ChefHat size={120} className="mb-6 animate-bounce" />
        <h1 className="text-6xl font-serif font-bold mb-4 tracking-tight">Navidad en la Mesa</h1>
        <p className="text-xl mb-12 opacity-80 max-w-md font-light italic">Recetario local diseñado para tu comodidad</p>
        <button 
          onClick={() => { setShowIntro(false); speak("Bienvenido."); }} 
          className={`px-16 py-6 text-2xl font-bold rounded-2xl shadow-2xl transform active:scale-95 transition-all ${settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-green border-b-8 border-green-900'}`}
        >
          Cocinar ahora
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-all duration-300`} style={{ fontSize: `${baseFontSize}px` }}>
      
      {/* 1. CABECERA PRINCIPAL (STICKY NIVEL 1) */}
      <header className={`p-4 h-[72px] flex justify-between items-center shadow-md sticky top-0 z-[100] ${settings.highContrast ? 'bg-black border-b-2 border-yellow-400' : 'bg-christmas-red text-white'}`}>
        <div 
          onClick={() => { setView({type: 'HOME'}); setActiveCategory(null); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
          className="flex items-center gap-3 cursor-pointer group"
          role="button"
          aria-label="Ir al Inicio"
        >
          <div className="p-2 rounded-lg group-hover:bg-white/10 transition-colors"><ChefHat size={28}/></div>
          <span className="font-serif font-bold text-2xl tracking-tighter">Navidad</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setSettings({...settings, highContrast: !settings.highContrast})} 
            className="p-3 rounded-xl hover:bg-white/10" 
            title={settings.highContrast ? "Modo Normal" : "Modo Contraste"}
          >
            {settings.highContrast ? <Sun size={24}/> : <Moon size={24}/>}
          </button>
          <button onClick={() => setView({type: 'CART'})} className="p-3 rounded-xl hover:bg-white/10 relative" title="Lista de compra">
            <ListChecks size={24}/>
            {menuIds.length > 0 && <span className={`absolute -top-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-black ${settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-accent text-black'}`}>{menuIds.length}</span>}
          </button>
          <button onClick={() => setView({type: 'SETTINGS'})} className="p-3 rounded-xl hover:bg-white/10" title="Ajustes"><SettingsIcon size={24}/></button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-32">
        {view.type === 'HOME' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* 2. FILTROS Y BUSCADOR (STICKY NIVEL 2) */}
            <div className={`sticky top-[72px] z-[90] -mx-4 px-4 md:-mx-8 md:px-8 py-4 border-b shadow-lg transition-colors ${bgColor} ${settings.highContrast ? 'border-yellow-400' : 'border-christmas-gold/10'}`}>
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="relative">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${settings.highContrast ? 'text-yellow-400' : 'text-christmas-gold'}`} size={20} />
                  <input 
                    type="text"
                    placeholder="Busca por nombre o ingrediente..."
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 focus:ring-4 outline-none transition-all ${cardBg}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="Categorías">
                  <button
                    onClick={() => { setActiveCategory(null); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                    className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap border-2 transition-all ${!activeCategory ? (settings.highContrast ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-christmas-red text-white border-christmas-red') : (settings.highContrast ? 'border-yellow-400 text-yellow-400' : 'border-christmas-gold/20 text-christmas-gold bg-white')}`}
                  >
                    Todas
                  </button>
                  {Object.values(Category).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setActiveCategory(cat); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                      className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap border-2 transition-all ${activeCategory === cat ? (settings.highContrast ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-christmas-red text-white border-christmas-red') : (settings.highContrast ? 'border-yellow-400 text-yellow-400' : 'border-christmas-gold/20 text-christmas-gold bg-white')}`}
                    >
                      {cat}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
            
            {/* 3. GRID DE RECETAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {filteredRecipes.map(recipe => (
                <article key={recipe.id} className={`group rounded-[2rem] overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col ${cardBg}`}>
                  <div className="h-52 relative overflow-hidden cursor-pointer" onClick={() => { setActiveRecipe(recipe); setView({type: 'RECIPE', recipeId: recipe.id}); window.scrollTo(0,0); }}>
                    <img src={recipe.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={recipe.title} />
                    <div className="absolute top-3 left-3">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-black/60 text-white'}`}>
                        {recipe.category}
                       </span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold font-serif text-xl mb-1 line-clamp-1">{recipe.title}</h3>
                      <p className="opacity-60 text-xs mb-4 line-clamp-2 italic">{recipe.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 opacity-70 text-[10px] font-black uppercase tracking-tighter">
                        <span className="flex items-center gap-1"><Clock size={12}/> {recipe.cookTimeMinutes}m</span>
                        <span className="flex items-center gap-1"><Info size={12}/> {recipe.difficulty}</span>
                      </div>
                      <button 
                        onClick={() => toggleMenuRecipe(recipe.id)}
                        className={`p-2 rounded-full transition-all ${menuIds.includes(recipe.id) ? (settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-green text-white') : (settings.highContrast ? 'border border-yellow-400 text-yellow-400' : 'bg-christmas-gold/10 text-christmas-gold hover:bg-christmas-gold/20')}`}
                      >
                        {menuIds.includes(recipe.id) ? <CheckCircle2 size={18}/> : <Plus size={18}/>}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Copyright />
          </div>
        )}

        {view.type === 'RECIPE' && activeRecipe && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in zoom-in-95 duration-300">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold text-xs uppercase opacity-60 hover:opacity-100"><ChevronLeft size={16}/> Volver</button>
            <div className={`rounded-[2.5rem] overflow-hidden shadow-2xl ${cardBg}`}>
              <img src={activeRecipe.imageUrl} className="w-full h-72 object-cover" alt="" />
              <div className="p-8 md:p-12 space-y-10">
                <h1 className={`text-4xl md:text-6xl font-serif font-bold ${accentColor}`}>{activeRecipe.title}</h1>
                
                <div className={`flex justify-between items-center p-6 rounded-2xl border ${settings.highContrast ? 'border-yellow-400' : 'bg-christmas-gold/5 border-christmas-gold/10'}`}>
                  <span className="font-bold uppercase text-xs tracking-widest flex items-center gap-2"><Users size={18}/> Raciones</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setServings(Math.max(1, servings - 1))} className={`w-10 h-10 rounded-full border-2 font-bold flex items-center justify-center ${settings.highContrast ? 'border-yellow-400 text-yellow-400' : 'border-christmas-gold text-christmas-gold'}`}>-</button>
                    <span className="text-3xl font-black">{servings}</span>
                    <button onClick={() => setServings(servings + 1)} className={`w-10 h-10 rounded-full border-2 font-bold flex items-center justify-center ${settings.highContrast ? 'border-yellow-400 text-yellow-400' : 'border-christmas-gold text-christmas-gold'}`}>+</button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                  <section>
                    <h3 className={`text-2xl font-serif font-bold mb-6 border-b-4 inline-block ${settings.highContrast ? 'border-yellow-400' : 'border-christmas-red'}`}>Ingredientes</h3>
                    <ul className="space-y-4">
                      {activeRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex justify-between border-b border-dashed border-current border-opacity-20 pb-2">
                          <span className="opacity-80 font-medium">{ing.name}</span>
                          <span className={`font-black ${accentColor}`}>
                            {(ing.amount * (servings / activeRecipe.servingsBase)).toFixed(1).replace('.0', '')} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <div className="flex flex-col justify-center gap-4">
                    <button 
                      onClick={() => { 
                        setView({type: 'COOKING', recipeId: activeRecipe.id}); 
                        setCurrentStep(0); 
                        speak(`Paso uno: ${activeRecipe.steps[0].description}`); 
                      }} 
                      className={`w-full py-6 text-2xl font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all ${btnSecondary}`}
                    >
                      <Play fill="currentColor" size={24}/> Modo Cocina
                    </button>
                    <button 
                      onClick={() => toggleMenuRecipe(activeRecipe.id)}
                      className={`w-full py-4 text-sm font-bold rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${menuIds.includes(activeRecipe.id) ? 'bg-black/5 opacity-80' : ''}`}
                    >
                      {menuIds.includes(activeRecipe.id) ? <><CheckCircle2 size={18}/> En el Menú</> : <><Plus size={18}/> Añadir al Menú</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <Copyright />
          </div>
        )}

        {view.type === 'COOKING' && activeRecipe && (
          <div className="flex flex-col gap-8 max-w-2xl mx-auto h-[70vh] justify-center items-center text-center">
            <div className="w-full flex justify-between items-center">
              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${settings.highContrast ? 'bg-yellow-400 text-black' : 'bg-christmas-gold/10 text-christmas-gold'}`}>
                Paso {currentStep + 1} de {activeRecipe.steps.length}
              </span>
              <button onClick={() => setView({type: 'RECIPE', recipeId: activeRecipe.id})} className="p-3 bg-black/5 rounded-full"><X size={20}/></button>
            </div>
            
            <div className={`w-full p-8 md:p-16 rounded-[3rem] border-8 shadow-2xl relative transition-all duration-500 ${settings.highContrast ? 'bg-black border-yellow-400 text-yellow-400' : 'bg-white border-christmas-green'}`}>
              <p className="text-3xl md:text-5xl font-serif font-bold leading-tight">
                {activeRecipe.steps[currentStep].description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button 
                disabled={currentStep === 0} 
                onClick={() => {
                  const prev = currentStep - 1;
                  setCurrentStep(prev);
                  speak(activeRecipe.steps[prev].description);
                }} 
                className={`py-6 rounded-2xl border-4 font-bold text-xl disabled:opacity-20 active:scale-95 transition-all ${settings.highContrast ? 'border-yellow-400 text-yellow-400' : 'border-gray-200'}`}
              >
                Anterior
              </button>
              <button 
                disabled={currentStep === activeRecipe.steps.length - 1} 
                onClick={() => {
                  const next = currentStep + 1;
                  setCurrentStep(next);
                  speak(activeRecipe.steps[next].description);
                }} 
                className={`py-6 rounded-2xl font-bold text-xl shadow-lg disabled:opacity-20 active:scale-95 transition-all ${btnSecondary}`}
              >
                {currentStep === activeRecipe.steps.length - 1 ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        )}

        {view.type === 'SETTINGS' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-300">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold text-xs uppercase opacity-60"><ChevronLeft size={16}/> Volver</button>
            <h2 className="text-4xl font-serif font-bold">Configuración</h2>
            
            <div className={`p-8 rounded-[2rem] shadow-xl space-y-8 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Modo de Pantalla</h3>
                  <p className="text-xs opacity-60">Cambia entre diseño navideño o alto contraste.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, highContrast: !settings.highContrast})} 
                  className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-yellow-400' : 'bg-gray-300'}`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white transform transition-transform ${settings.highContrast ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Type className={accentColor} />
                  <div>
                    <h3 className="font-bold text-lg">Tamaño del Texto</h3>
                    <p className="text-xs opacity-60">Escala la interfaz para una mejor lectura.</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0.8, 1, 1.2, 1.5].map(val => (
                    <button 
                      key={val}
                      onClick={() => setSettings({...settings, fontSizeMultiplier: val})}
                      className={`py-3 rounded-xl font-bold border-2 transition-all ${settings.fontSizeMultiplier === val ? (settings.highContrast ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-christmas-red text-white border-christmas-red') : 'border-gray-200 opacity-60'}`}
                    >
                      {val === 1 ? '100%' : `${val * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Asistente de Voz</h3>
                  <p className="text-xs opacity-60">Lectura de pasos durante el cocinado.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})} 
                  className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.voiceEnabled ? (settings.highContrast ? 'bg-yellow-400' : 'bg-christmas-green') : 'bg-gray-300'}`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white transform transition-transform ${settings.voiceEnabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            </div>
            <Copyright />
          </div>
        )}

        {view.type === 'CART' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-300">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold text-xs uppercase opacity-60"><ChevronLeft size={16}/> Volver</button>
            <div className="flex justify-between items-end">
               <h2 className="text-4xl font-serif font-bold">Mi Compra</h2>
               {menuIds.length > 0 && (
                 <button onClick={() => setMenuIds([])} className="text-red-500 flex items-center gap-1 text-xs font-bold uppercase"><Trash2 size={16}/> Vaciar</button>
               )}
            </div>

            {menuRecipes.length === 0 ? (
              <div className={`p-16 text-center rounded-[2.5rem] border-2 border-dashed ${cardBg} border-opacity-30`}>
                <p className="opacity-50">Selecciona recetas para generar tu lista automáticamente.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`p-6 rounded-2xl ${cardBg}`}>
                  <h3 className="font-bold mb-4 flex items-center gap-2"><ListChecks className={accentColor}/> Ingredientes Totales</h3>
                  <div className="grid gap-3">
                    {shoppingList.map(([name, data], idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-black/5 rounded-xl border border-transparent hover:border-christmas-gold/20 transition-all">
                        <span className="capitalize font-medium">{name}</span>
                        <span className={`font-black ${accentColor}`}>{data.amount.toFixed(1).replace('.0', '')} {data.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Copyright />
          </div>
        )}
      </main>

      {/* FOOTER MÓVIL (TAB BAR) */}
      <footer className={`md:hidden fixed bottom-0 left-0 right-0 p-4 border-t shadow-2xl z-50 transition-all ${settings.highContrast ? 'bg-black border-yellow-400' : 'bg-white border-christmas-gold/10'}`}>
         <div className="flex justify-around items-center">
            <button onClick={() => { setView({type: 'HOME'}); window.scrollTo({top: 0, behavior: 'smooth'}); }} className={`flex flex-col items-center gap-1 ${view.type === 'HOME' ? accentColor : 'opacity-40'}`}>
               <Eye size={20} /><span className="text-[10px] font-bold">Explorar</span>
            </button>
            <button onClick={() => setView({type: 'CART'})} className={`flex flex-col items-center gap-1 ${view.type === 'CART' ? accentColor : 'opacity-40'}`}>
               <ListChecks size={20} /><span className="text-[10px] font-bold">Lista</span>
            </button>
            <button onClick={() => setView({type: 'SETTINGS'})} className={`flex flex-col items-center gap-1 ${view.type === 'SETTINGS' ? accentColor : 'opacity-40'}`}>
               <SettingsIcon size={20} /><span className="text-[10px] font-bold">Ajustes</span>
            </button>
         </div>
      </footer>
    </div>
  );
}
