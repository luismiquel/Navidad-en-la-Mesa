
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

  // --- LÓGICA DE VOZ NATIVA ---
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

  // --- ESTILOS DINÁMICOS BASADOS EN TEMA ---
  const baseFontSize = 16 * settings.fontSizeMultiplier;
  const bgColor = settings.highContrast ? 'bg-christmas-dark' : 'bg-christmas-cream';
  const textColor = settings.highContrast ? 'text-white' : 'text-christmas-dark';
  const cardBg = settings.highContrast ? 'bg-gray-800 border-2 border-christmas-accent' : 'bg-white border-christmas-gold/20';
  const accentColor = settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red';
  const btnSecondary = settings.highContrast ? 'border-2 border-christmas-accent text-christmas-accent bg-christmas-dark' : 'bg-christmas-green text-white';

  const Copyright = () => (
    <div className="py-12 mt-12 border-t border-christmas-gold/10 text-center opacity-40">
      <p className="font-serif italic text-sm mb-1">Navidad en la Mesa © 2024</p>
      <p className="font-bold text-[10px] uppercase tracking-[0.2em]">Creada por Luis Miguel García de las Morenas</p>
    </div>
  );

  if (showIntro) {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 text-center transition-colors duration-700 ${settings.highContrast ? 'bg-christmas-dark text-christmas-accent' : 'bg-christmas-red text-white'}`} style={{ fontSize: `${baseFontSize}px` }}>
        <ChefHat size={120} className="mb-6 animate-bounce" />
        <h1 className="text-6xl font-serif font-bold mb-4 tracking-tight">Navidad en la Mesa</h1>
        <p className="text-xl mb-12 opacity-80 max-w-md font-light italic">Tu recetario festivo local y accesible</p>
        <button 
          onClick={() => { setShowIntro(false); speak("Bienvenido."); }} 
          className={`px-16 py-6 text-2xl font-bold rounded-2xl shadow-2xl transform active:scale-95 transition-all ${settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-christmas-green border-b-8 border-green-900'}`}
        >
          Abrir Recetario
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} font-sans transition-all duration-300`} style={{ fontSize: `${baseFontSize}px` }}>
      
      {/* 1. HEADER FIJO (STICKY NIVEL 1) */}
      <header className={`p-4 h-[72px] flex justify-between items-center shadow-lg sticky top-0 z-[100] ${settings.highContrast ? 'bg-black border-b-2 border-christmas-accent' : 'bg-christmas-red text-white'}`}>
        <div 
          onClick={() => { setView({type: 'HOME'}); setActiveCategory(null); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
          className="flex items-center gap-3 cursor-pointer group"
          role="button"
          aria-label="Volver al inicio"
        >
          <div className="p-2 rounded-lg group-hover:bg-white/10 transition-colors"><ChefHat size={28}/></div>
          <span className="font-serif font-bold text-2xl tracking-tighter">Navidad</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setSettings({...settings, highContrast: !settings.highContrast})} 
            className="p-3 rounded-xl hover:bg-white/10 transition-colors" 
            title={settings.highContrast ? "Modo Normal" : "Modo Contraste"}
          >
            {settings.highContrast ? <Sun size={24}/> : <Moon size={24}/>}
          </button>
          <button onClick={() => setView({type: 'CART'})} className="p-3 rounded-xl hover:bg-white/10 relative" title="Lista de compra">
            <ListChecks size={24}/>
            {menuIds.length > 0 && <span className={`absolute -top-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-black ${settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-christmas-accent text-black'}`}>{menuIds.length}</span>}
          </button>
          <button onClick={() => setView({type: 'SETTINGS'})} className="p-3 rounded-xl hover:bg-white/10" title="Ajustes"><SettingsIcon size={24}/></button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-32">
        {view.type === 'HOME' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* 2. BARRA DE FILTROS STICKY (STICKY NIVEL 2) */}
            <div className={`sticky top-[72px] z-[90] -mx-4 px-4 md:-mx-8 md:px-8 py-4 border-b shadow-xl transition-colors ${bgColor} ${settings.highContrast ? 'border-christmas-accent/30' : 'border-christmas-gold/10'}`}>
              <div className="max-w-5xl mx-auto space-y-4">
                {/* BUSCADOR LOCAL */}
                <div className="relative">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-gold'}`} size={20} />
                  <input 
                    type="text"
                    placeholder="Busca una receta..."
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 focus:ring-4 outline-none transition-all ${cardBg}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* CATEGORÍAS */}
                <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="Secciones del recetario">
                  <button
                    onClick={() => { setActiveCategory(null); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                    className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap border-2 transition-all ${!activeCategory ? (settings.highContrast ? 'bg-christmas-accent text-christmas-dark border-christmas-accent' : 'bg-christmas-red text-white border-christmas-red') : (settings.highContrast ? 'border-christmas-accent text-christmas-accent bg-transparent' : 'border-christmas-gold/20 text-christmas-gold bg-white')}`}
                  >
                    Todas las Recetas
                  </button>
                  {Object.values(Category).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setActiveCategory(cat); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                      className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap border-2 transition-all ${activeCategory === cat ? (settings.highContrast ? 'bg-christmas-accent text-christmas-dark border-christmas-accent' : 'bg-christmas-red text-white border-christmas-red') : (settings.highContrast ? 'border-christmas-accent text-christmas-accent bg-transparent' : 'border-christmas-gold/20 text-christmas-gold bg-white')}`}
                    >
                      {cat}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
            
            {/* GRID DE RECETAS (SCROLL) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {filteredRecipes.map(recipe => (
                <article key={recipe.id} className={`group rounded-[2.5rem] overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col ${cardBg}`}>
                  <div className="h-56 relative overflow-hidden cursor-pointer" onClick={() => { setActiveRecipe(recipe); setView({type: 'RECIPE', recipeId: recipe.id}); window.scrollTo(0,0); }}>
                    <img src={recipe.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={recipe.title} />
                    <div className="absolute top-4 left-4">
                       <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-black/60 text-white'}`}>
                        {recipe.category}
                       </span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold font-serif text-2xl mb-2 line-clamp-1">{recipe.title}</h3>
                      <p className="opacity-60 text-xs mb-6 line-clamp-2 italic leading-relaxed">{recipe.description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-current border-opacity-10">
                      <div className="flex gap-4 opacity-70 text-[10px] font-black uppercase tracking-tighter">
                        <span className="flex items-center gap-1"><Clock size={12}/> {recipe.cookTimeMinutes}m</span>
                        <span className="flex items-center gap-1"><Info size={12}/> {recipe.difficulty}</span>
                      </div>
                      <button 
                        onClick={() => toggleMenuRecipe(recipe.id)}
                        className={`p-3 rounded-full transition-all active:scale-90 ${menuIds.includes(recipe.id) ? (settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-christmas-green text-white') : (settings.highContrast ? 'border-2 border-christmas-accent text-christmas-accent hover:bg-christmas-accent/10' : 'bg-christmas-gold/10 text-christmas-gold hover:bg-christmas-gold/20')}`}
                      >
                        {menuIds.includes(recipe.id) ? <CheckCircle2 size={20}/> : <Plus size={20}/>}
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
          <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold text-xs uppercase opacity-60 hover:opacity-100 transition-opacity"><ChevronLeft size={16}/> Volver al listado</button>
            <div className={`rounded-[3rem] overflow-hidden shadow-2xl ${cardBg}`}>
              <div className="h-80 relative">
                <img src={activeRecipe.imageUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-none">{activeRecipe.title}</h1>
                </div>
              </div>
              
              <div className="p-8 md:p-12 space-y-12">
                <div className={`flex flex-col sm:flex-row justify-between items-center p-8 rounded-[2rem] border ${settings.highContrast ? 'border-christmas-accent bg-transparent' : 'bg-christmas-gold/5 border-christmas-gold/10'}`}>
                  <div className="mb-4 sm:mb-0 text-center sm:text-left">
                    <span className="font-bold uppercase text-xs tracking-[0.2em] flex items-center justify-center sm:justify-start gap-2 mb-1"><Users size={18} className={accentColor}/> Raciones</span>
                    <p className="text-xs opacity-60">Calculamos los ingredientes por ti</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <button onClick={() => setServings(Math.max(1, servings - 1))} className={`w-12 h-12 rounded-full border-2 font-bold text-xl flex items-center justify-center transition-all active:scale-90 ${settings.highContrast ? 'border-christmas-accent text-christmas-accent' : 'border-christmas-gold text-christmas-gold'}`}>-</button>
                    <span className="text-4xl font-black">{servings}</span>
                    <button onClick={() => setServings(servings + 1)} className={`w-12 h-12 rounded-full border-2 font-bold text-xl flex items-center justify-center transition-all active:scale-90 ${settings.highContrast ? 'border-christmas-accent text-christmas-accent' : 'border-christmas-gold text-christmas-gold'}`}>+</button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-16">
                  <section>
                    <h3 className={`text-3xl font-serif font-bold mb-8 border-b-8 inline-block ${settings.highContrast ? 'border-christmas-accent' : 'border-christmas-red'}`}>Ingredientes</h3>
                    <ul className="space-y-5">
                      {activeRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex justify-between items-center border-b border-dashed border-current border-opacity-20 pb-3">
                          <span className="opacity-80 font-medium text-lg">{ing.name}</span>
                          <span className={`font-black text-xl ${accentColor}`}>
                            {(ing.amount * (servings / activeRecipe.servingsBase)).toFixed(1).replace('.0', '')} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <div className="flex flex-col justify-center gap-6">
                    <button 
                      onClick={() => { 
                        setView({type: 'COOKING', recipeId: activeRecipe.id}); 
                        setCurrentStep(0); 
                        speak(`Paso uno: ${activeRecipe.steps[0].description}`); 
                      }} 
                      className={`w-full py-8 text-2xl font-black rounded-3xl shadow-xl flex items-center justify-center gap-4 transform active:scale-95 transition-all ${btnSecondary}`}
                    >
                      <Play fill="currentColor" size={28}/> MODO COCINA
                    </button>
                    <button 
                      onClick={() => toggleMenuRecipe(activeRecipe.id)}
                      className={`w-full py-5 text-sm font-bold rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${menuIds.includes(activeRecipe.id) ? (settings.highContrast ? 'bg-christmas-accent text-christmas-dark border-christmas-accent' : 'bg-black/5 border-transparent') : 'border-current border-opacity-20 hover:bg-current hover:bg-opacity-5'}`}
                    >
                      {menuIds.includes(activeRecipe.id) ? <><CheckCircle2 size={20}/> En tu Menú</> : <><Plus size={20}/> Añadir al Menú</>}
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
            <div className="w-full flex justify-between items-center mb-4">
              <span className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest ${settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-christmas-gold/10 text-christmas-gold'}`}>
                Paso {currentStep + 1} de {activeRecipe.steps.length}
              </span>
              <button onClick={() => setView({type: 'RECIPE', recipeId: activeRecipe.id})} className="p-3 bg-black/5 rounded-full hover:bg-black/10 transition-colors"><X size={24}/></button>
            </div>
            
            <div className={`w-full p-10 md:p-20 rounded-[4rem] border-[12px] shadow-2xl relative transition-all duration-500 ${settings.highContrast ? 'bg-black border-christmas-accent text-christmas-accent' : 'bg-white border-christmas-green text-christmas-dark'}`}>
              <p className="text-4xl md:text-6xl font-serif font-bold leading-tight">
                {activeRecipe.steps[currentStep].description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
              <button 
                disabled={currentStep === 0} 
                onClick={() => {
                  const prev = currentStep - 1;
                  setCurrentStep(prev);
                  speak(activeRecipe.steps[prev].description);
                }} 
                className={`py-8 rounded-3xl border-4 font-black text-xl disabled:opacity-20 active:scale-95 transition-all ${settings.highContrast ? 'border-christmas-accent text-christmas-accent' : 'border-gray-200'}`}
              >
                ANTERIOR
              </button>
              <button 
                disabled={currentStep === activeRecipe.steps.length - 1} 
                onClick={() => {
                  const next = currentStep + 1;
                  setCurrentStep(next);
                  speak(activeRecipe.steps[next].description);
                }} 
                className={`py-8 rounded-3xl font-black text-xl shadow-lg disabled:opacity-20 active:scale-95 transition-all ${btnSecondary}`}
              >
                {currentStep === activeRecipe.steps.length - 1 ? 'FINALIZAR' : 'SIGUIENTE'}
              </button>
            </div>
          </div>
        )}

        {view.type === 'SETTINGS' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-300">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold text-xs uppercase opacity-60"><ChevronLeft size={16}/> Volver al Inicio</button>
            <h2 className="text-5xl font-serif font-bold">Configuración</h2>
            
            <div className={`p-8 rounded-[2.5rem] shadow-xl space-y-10 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl">Modo Visual</h3>
                  <p className="text-xs opacity-60">Contraste optimizado para lectura.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, highContrast: !settings.highContrast})} 
                  className={`w-16 h-9 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-christmas-accent' : 'bg-gray-300'}`}
                >
                  <div className={`w-7 h-7 rounded-full bg-white shadow-md transform transition-transform ${settings.highContrast ? 'translate-x-7' : ''}`} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <Type className={accentColor} />
                  <div>
                    <h3 className="font-bold text-xl">Tamaño de Interfaz</h3>
                    <p className="text-xs opacity-60">Escalado global del texto.</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[0.8, 1, 1.2, 1.5].map(val => (
                    <button 
                      key={val}
                      onClick={() => setSettings({...settings, fontSizeMultiplier: val})}
                      className={`py-4 rounded-2xl font-black border-2 transition-all ${settings.fontSizeMultiplier === val ? (settings.highContrast ? 'bg-christmas-accent text-christmas-dark border-christmas-accent' : 'bg-christmas-red text-white border-christmas-red') : 'border-current border-opacity-10 opacity-40 hover:opacity-100'}`}
                    >
                      {val === 1 ? '100%' : `${val * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl">Asistente de Voz</h3>
                  <p className="text-xs opacity-60">Locución automática de pasos.</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})} 
                  className={`w-16 h-9 rounded-full p-1 transition-colors ${settings.voiceEnabled ? (settings.highContrast ? 'bg-christmas-accent' : 'bg-christmas-green') : 'bg-gray-300'}`}
                >
                  <div className={`w-7 h-7 rounded-full bg-white shadow-md transform transition-transform ${settings.voiceEnabled ? 'translate-x-7' : ''}`} />
                </button>
              </div>
            </div>
            <Copyright />
          </div>
        )}

        {view.type === 'CART' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-300">
            <button onClick={() => setView({type: 'HOME'})} className="flex items-center gap-2 font-bold text-xs uppercase opacity-60"><ChevronLeft size={16}/> Volver a explorar</button>
            <div className="flex justify-between items-end">
               <h2 className="text-5xl font-serif font-bold">Mi Compra</h2>
               {menuIds.length > 0 && (
                 <button onClick={() => setMenuIds([])} className="text-red-500 flex items-center gap-1 text-xs font-black uppercase hover:underline"><Trash2 size={20}/> Vaciar lista</button>
               )}
            </div>

            {menuRecipes.length === 0 ? (
              <div className={`p-20 text-center rounded-[3rem] border-4 border-dashed ${cardBg} border-opacity-30`}>
                <p className="text-xl opacity-50 font-serif italic">Tu lista de ingredientes está vacía. Añade platos desde el explorador.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className={`p-8 rounded-[2.5rem] shadow-xl ${cardBg}`}>
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-3"><ListChecks className={accentColor}/> Ingredientes para tu menú</h3>
                  <div className="grid gap-4">
                    {shoppingList.map(([name, data], idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-black/5 rounded-2xl border border-transparent hover:border-current hover:border-opacity-10 transition-all">
                        <span className="capitalize font-medium text-lg">{name}</span>
                        <span className={`font-black text-xl ${accentColor}`}>{data.amount.toFixed(1).replace('.0', '')} {data.unit}</span>
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

      {/* FOOTER MÓVIL PERSISTENTE (TAB BAR) */}
      <footer className={`md:hidden fixed bottom-0 left-0 right-0 p-4 border-t shadow-2xl z-[100] transition-all ${settings.highContrast ? 'bg-black border-christmas-accent' : 'bg-white border-christmas-gold/10'}`}>
         <div className="flex justify-around items-center">
            <button onClick={() => { setView({type: 'HOME'}); window.scrollTo({top: 0, behavior: 'smooth'}); }} className={`flex flex-col items-center gap-1 transition-all ${view.type === 'HOME' ? accentColor : 'opacity-30'}`}>
               <Eye size={24} /><span className="text-[10px] font-black uppercase tracking-tighter">Explorar</span>
            </button>
            <button onClick={() => setView({type: 'CART'})} className={`flex flex-col items-center gap-1 transition-all ${view.type === 'CART' ? accentColor : 'opacity-30'}`}>
               <ListChecks size={24} /><span className="text-[10px] font-black uppercase tracking-tighter">Mi Menú</span>
            </button>
            <button onClick={() => setView({type: 'SETTINGS'})} className={`flex flex-col items-center gap-1 transition-all ${view.type === 'SETTINGS' ? accentColor : 'opacity-30'}`}>
               <SettingsIcon size={24} /><span className="text-[10px] font-black uppercase tracking-tighter">Ajustes</span>
            </button>
         </div>
      </footer>
    </div>
  );
}
