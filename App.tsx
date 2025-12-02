
import React, { useState, useEffect, useRef } from 'react';
import { SAMPLE_RECIPES } from './data';
import { Recipe, Category, ViewState, AppSettings, Ingredient } from './types';
import { generateCookingAssistance } from './services/geminiService';
import { 
  ChefHat, ShoppingCart, Heart, Settings, Search, Clock, ArrowLeft, Mic, 
  Trash2, Plus, Minus, XCircle, Play, Check
} from 'lucide-react';

// --- LOGIC HELPERS ---

const aggregateIngredients = (items: Ingredient[]) => {
  const map = new Map<string, Ingredient>();
  
  items.forEach(item => {
    const key = `${item.name.toLowerCase().trim()}-${item.unit.toLowerCase()}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.set(key, { ...existing, amount: existing.amount + item.amount });
    } else {
      map.set(key, { ...item });
    }
  });
  
  return Array.from(map.values());
};

// Normalizar texto para mejorar coincidencia (quita acentos y mayúsculas)
const normalizeText = (text: string) => {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// --- VOICE UTILS (ROBUST) ---

// Referencia global para evitar que el Garbage Collector elimine el audio a mitad de frase
let globalUtterance: SpeechSynthesisUtterance | null = null;

const speakRobust = (text: string, onEnd?: () => void) => {
  if (!text) {
    if(onEnd) onEnd();
    return;
  }

  // 1. Cancelar cualquier audio anterior inmediatamente
  window.speechSynthesis.cancel();
  
  // 2. Fix Chrome/Safari: Si el motor se quedó pausado, lo reactivamos
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();

  // 3. Pequeño retardo para asegurar que el canal de audio se limpió
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    globalUtterance = u; // Guardar referencia

    u.lang = 'es-ES';
    u.rate = 1.1; // Ritmo ágil
    u.pitch = 1.0;

    u.onend = () => {
      globalUtterance = null;
      if (onEnd) onEnd();
    };

    u.onerror = (e) => {
      // Ignoramos errores de cancelación manual
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
         console.warn("TTS Error:", e);
      }
      globalUtterance = null;
      // No ejecutamos onEnd en error para evitar bucles de reinicio de micro
    };

    window.speechSynthesis.speak(u);
  }, 50);
};

// --- COMPONENTS ---

const FestiveImage = ({
  src,
  alt,
  className = "",
  isHighContrast,
  children
}: {
  src: string;
  alt: string;
  className?: string;
  isHighContrast: boolean;
  children?: React.ReactNode;
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <div className={`relative overflow-hidden ${className} ${status === 'loading' ? 'animate-pulse bg-gray-200' : ''}`}>
      {status === 'error' ? (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 text-center ${
          isHighContrast ? 'bg-christmas-dark text-christmas-accent' : 'bg-christmas-cream text-christmas-red'
        }`}>
          <ChefHat size={48} className="mb-2 opacity-50" />
          <span className="text-sm font-serif italic opacity-75">Imagen no disponible</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`w-full h-full object-cover transform transition-transform duration-700 ease-in-out group-hover:scale-110 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          } ${isHighContrast ? 'contrast-125 grayscale' : ''}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
      {children}
    </div>
  );
};

const Header = ({ 
  settings, 
  setViewState, 
  cartCount 
}: { 
  settings: AppSettings; 
  setViewState: (v: ViewState) => void; 
  cartCount: number 
}) => {
  const isDark = settings.highContrast;
  
  return (
    <header className={`p-4 sticky top-0 z-50 shadow-md flex justify-between items-center transition-colors ${
      isDark ? 'bg-christmas-dark text-christmas-accent border-b-2 border-christmas-accent' : 'bg-christmas-red text-christmas-cream border-b-4 border-christmas-gold'
    }`}>
      <button 
        onClick={() => setViewState({ type: 'HOME' })}
        className="flex items-center gap-2 font-serif font-bold text-xl hover:scale-105 transition-transform"
        aria-label="Ir al inicio"
      >
        <ChefHat className={`w-8 h-8 ${isDark ? 'text-christmas-accent' : 'text-christmas-accent'}`} />
        <span className="hidden sm:inline drop-shadow-md tracking-wide">Navidad en la Mesa</span>
      </button>
      
      <div className="flex gap-4">
        <button onClick={() => setViewState({ type: 'FAVORITES' })} aria-label="Ver Favoritos" className="hover:bg-white/10 p-2 rounded-full transition">
          <Heart className="w-6 h-6" />
        </button>
        <button onClick={() => setViewState({ type: 'CART' })} aria-label={`Ver lista de compra, ${cartCount} elementos`} className="relative hover:bg-white/10 p-2 rounded-full transition">
          <ShoppingCart className="w-6 h-6" />
          {cartCount > 0 && (
            <span className={`absolute top-0 right-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border shadow-sm ${
              isDark ? 'bg-christmas-accent text-christmas-dark border-christmas-dark' : 'bg-christmas-accent text-christmas-red border-christmas-red'
            }`}>
              {cartCount}
            </span>
          )}
        </button>
        <button onClick={() => setViewState({ type: 'SETTINGS' })} aria-label="Abrir Configuración" className="hover:bg-white/10 p-2 rounded-full transition">
          <Settings className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};

const RecipeCard: React.FC<{ 
  recipe: Recipe; 
  onClick: () => void; 
  isHighContrast: boolean; 
  fontSizeClass: string 
}> = ({ 
  recipe, 
  onClick, 
  isHighContrast, 
  fontSizeClass 
}) => (
  <button 
    onClick={onClick}
    aria-label={`Receta de ${recipe.title}. Categoría ${recipe.category}. Dificultad ${recipe.difficulty}.`}
    className={`group w-full text-left rounded-xl overflow-hidden shadow-md transform transition-all hover:scale-[1.02] hover:shadow-xl flex flex-col h-full ${
      isHighContrast 
        ? 'bg-christmas-dark border-2 border-christmas-accent text-christmas-cream' 
        : 'bg-white border border-christmas-gold/30 ring-1 ring-christmas-gold/10'
    }`}
  >
    <div className={`relative ${isHighContrast ? 'border-b border-christmas-accent' : 'border-b-[3px] border-christmas-gold'}`}>
      <FestiveImage 
        src={recipe.imageUrl} 
        alt={`Plato: ${recipe.title}, Categoría: ${recipe.category}`}
        className="h-56 w-full bg-gray-200"
        isHighContrast={isHighContrast}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60"></div>
        <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-sm border border-white/20 ${
          isHighContrast 
            ? 'bg-christmas-dark/90 text-christmas-accent border-christmas-accent' 
            : 'bg-christmas-red/90 text-white'
        }`}>
          <Clock className="w-3.5 h-3.5" /> 
          <span>{recipe.prepTimeMinutes + recipe.cookTimeMinutes} min</span>
        </div>
      </FestiveImage>
    </div>
    
    <div className="p-4 flex-1 flex flex-col">
      <h3 className={`font-serif font-bold mb-2 leading-tight ${fontSizeClass} ${isHighContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
        {recipe.title}
      </h3>
      <div className="flex flex-wrap gap-1 mt-auto pt-2">
        {recipe.tags.slice(0, 3).map(tag => (
          <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
            isHighContrast 
              ? 'bg-christmas-accent text-christmas-dark border-transparent' 
              : 'bg-christmas-cream text-christmas-green border-christmas-green/30'
          }`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  </button>
);

// --- COMPONENTE MODO COCINA ACCESIBLE (BLIND-FIRST) ---
const CookingMode = ({ 
  recipe, 
  settings, 
  onClose,
}: { 
  recipe: Recipe; 
  settings: AppSettings; 
  onClose: () => void;
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [displayStatus, setDisplayStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [aiMessage, setAiMessage] = useState<string>("Toca para hablar");
  
  const statusRef = useRef<'idle' | 'listening' | 'speaking'>('idle');
  const hasSpokenInit = useRef(false);
  const previousStepRef = useRef(0);

  // WAKE LOCK: Mantiene la pantalla encendida
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // @ts-ignore
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) { console.warn("Wake Lock error:", err); }
    };
    requestWakeLock();
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  const updateStatus = (newStatus: 'idle' | 'listening' | 'speaking') => {
    statusRef.current = newStatus;
    setDisplayStatus(newStatus);
  };

  // INICIO: Mensaje de Bienvenida y Primer Paso
  useEffect(() => {
    if (!hasSpokenInit.current) {
      setTimeout(() => {
        speakRobust(
          `Bienvenido a la cocina. Vamos a preparar ${recipe.title}. Paso 1: ${recipe.steps[0].description}. Toca la pantalla y di Siguiente para continuar.`,
          () => updateStatus('idle')
        );
      }, 600);
      hasSpokenInit.current = true;
      previousStepRef.current = 0;
    }
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // LECTURA AUTOMÁTICA AL CAMBIAR DE PASO CON FEEDBACK DE NAVEGACIÓN
  useEffect(() => {
    if (hasSpokenInit.current) {
      // Determinamos si vamos adelante o atrás para dar feedback
      const direction = currentStep > previousStepRef.current ? 'next' : currentStep < previousStepRef.current ? 'prev' : 'same';
      let introPhrase = `Paso ${currentStep + 1}.`;

      if (direction === 'next') {
        introPhrase = `Muy bien. Avanzando al paso ${currentStep + 1}.`;
      } else if (direction === 'prev') {
        introPhrase = `Entendido. Volviendo al paso ${currentStep + 1}.`;
      }

      previousStepRef.current = currentStep; // Actualizamos referencia

      setTimeout(() => {
        speakRobust(`${introPhrase} ${recipe.steps[currentStep].description}`, () => updateStatus('idle'));
      }, 200);
    }
  }, [currentStep]);

  const activateListening = () => {
    if (statusRef.current === 'listening' || statusRef.current === 'speaking') return;

    updateStatus('listening');
    setAiMessage("ESCUCHANDO...");
    
    // Hablamos brevemente y luego activamos el micro
    speakRobust("Dime.", () => {
      startRecognition();
    });
  };

  const startRecognition = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.");
      updateStatus('idle');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = async (e: any) => {
      recognition.stop();
      updateStatus('speaking');
      
      const transcript = normalizeText(e.results[0][0].transcript);
      console.log("Orden Cocina:", transcript);
      
      // Lógica "Fuzzy" con texto normalizado
      const isNext = ['siguiente', 'avanza', 'proximo', 'sigue', 'pasa', 'otro', 'si', 'venga', 'adelante'].some(w => transcript.includes(w));
      const isPrev = ['atras', 'anterior', 'vuelve', 'retrocede', 'antes'].some(w => transcript.includes(w));
      const isRepeat = ['repite', 'repetir', 'que', 'como', 'otra vez', 'lee'].some(w => transcript.includes(w));
      const isExit = ['salir', 'cerrar', 'terminar', 'fin', 'adios', 'fuera'].some(w => transcript.includes(w));

      if (isNext) {
        if (currentStep < recipe.steps.length - 1) {
          setAiMessage("Siguiente...");
          setCurrentStep(p => p + 1);
        } else {
          speakRobust("¡Es el último paso! ¡Buen provecho!", () => updateStatus('idle'));
        }
      } else if (isPrev) {
        if (currentStep > 0) {
          setAiMessage("Anterior...");
          setCurrentStep(p => p - 1);
        } else {
          speakRobust("Estás en el primer paso.", () => updateStatus('idle'));
        }
      } else if (isRepeat) {
        setAiMessage("Repitiendo...");
        speakRobust(`Repito. ${recipe.steps[currentStep].description}`, () => updateStatus('idle'));

      } else if (isExit) {
        speakRobust("Saliendo de la cocina.");
        onClose();

      } else {
        // Consulta a Gemini IA
        setAiMessage("Consultando...");
        try {
          const reply = await generateCookingAssistance(recipe, currentStep, transcript);
          setAiMessage(reply);
          speakRobust(reply, () => updateStatus('idle'));
        } catch (error) {
          speakRobust("No puedo conectar ahora.", () => updateStatus('idle'));
        }
      }
    };

    recognition.onerror = () => {
      speakRobust("No te he oído. Toca y repite.", () => updateStatus('idle'));
      setAiMessage("Toca para repetir");
    };

    recognition.onend = () => {
        // Aseguramos que si no se capturó nada, volvemos a idle
        if (statusRef.current === 'listening') {
             updateStatus('idle');
        }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("Recognition already started or error", e);
      // Si ya estaba activo, no pasa nada grave, reseteamos a idle si es necesario
      if (statusRef.current === 'listening') updateStatus('idle');
    }
  };

  // COLORES DINÁMICOS PARA FEEDBACK VISUAL
  const isHighContrast = settings.highContrast;
  let bgColorClass = isHighContrast ? 'bg-christmas-dark' : 'bg-christmas-cream'; 
  let textColorClass = isHighContrast ? 'text-christmas-cream' : 'text-christmas-dark';
  
  // Feedback visual masivo al escuchar
  if (displayStatus === 'listening') {
    bgColorClass = isHighContrast ? 'bg-christmas-accent' : 'bg-christmas-red'; // Amarillo o Rojo intenso
    textColorClass = isHighContrast ? 'text-black' : 'text-white';
  } else if (displayStatus === 'speaking') {
     // Color intermedio mientras habla
     bgColorClass = isHighContrast ? 'bg-gray-800' : 'bg-orange-100';
  }

  return (
    <div 
      onClick={activateListening}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors duration-300 ${bgColorClass}`}
      role="button"
      aria-label="Modo cocina activo. Toda la pantalla es un botón. Toca para dar una orden."
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 left-6 p-4 rounded-full bg-black/20 text-white hover:bg-black/40 z-50"
        aria-label="Cerrar modo cocina"
      >
        <XCircle size={48} />
      </button>

      <div className={`mb-8 font-bold uppercase tracking-widest text-3xl ${textColorClass} ${displayStatus === 'listening' ? 'animate-pulse scale-110' : ''}`}>
        {displayStatus === 'listening' ? '👂 TE ESCUCHO...' : displayStatus === 'speaking' ? '🗣️ HABLANDO' : '👆 TOCA PARA HABLAR'}
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-4xl w-full">
        <h2 className={`font-serif font-bold text-4xl mb-6 opacity-60 ${textColorClass}`}>
          Paso {currentStep + 1} de {recipe.steps.length}
        </h2>
        
        {/* Texto muy grande para baja visión */}
        <p className={`font-serif font-bold leading-tight ${textColorClass}`} style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}>
          {recipe.steps[currentStep].description}
        </p>

        {/* Caja de mensajes de IA / Estado */}
        <div className={`mt-12 text-3xl font-bold p-8 rounded-3xl border-4 min-h-[150px] flex items-center justify-center ${
          displayStatus === 'listening' 
            ? 'border-white bg-white/20 text-white' 
            : `border-current ${textColorClass} bg-black/5`
        }`}>
          {aiMessage}
        </div>
      </div>
      
      {/* Indicadores de ayuda visual en la parte inferior */}
      <div className={`mt-8 text-lg font-bold opacity-70 ${textColorClass}`}>
        DI: "SIGUIENTE" • "ATRÁS" • "REPITE"
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [viewState, setViewState] = useState<ViewState>({ type: 'HOME' });
  const [settings, setSettings] = useState<AppSettings>({ highContrast: false, fontSizeMultiplier: 1, voiceEnabled: true });
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('favorites') || '[]'));
  const [cart, setCart] = useState<Ingredient[]>(() => JSON.parse(localStorage.getItem('cart') || '[]'));
  
  const [servings, setServings] = useState(4);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDiet, setFilterDiet] = useState<string | null>(null);

  // Estado para el asistente global
  const [isGlobalListening, setIsGlobalListening] = useState(false);

  useEffect(() => localStorage.setItem('favorites', JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);

  // FEEDBACK AUDITIVO AUTOMÁTICO AL CAMBIAR PANTALLA
  useEffect(() => {
    if (!settings.voiceEnabled || showIntro || isGlobalListening) return;
    
    let text = "";
    if (viewState.type === 'HOME') {
        text = "Inicio. ¿Qué te apetece cocinar?";
    }
    else if (viewState.type === 'CATEGORY') {
        // LECTURA AUTOMÁTICA DE RECETAS (Blind-First)
        const catRecipes = SAMPLE_RECIPES.filter(r => r.category === viewState.category);
        const firstFew = catRecipes.slice(0, 3);
        const names = firstFew.map((r, i) => `Número ${i+1}. ${r.title}`).join('. ');
        text = `Categoría ${viewState.category}. Aquí tienes las primeras opciones: ${names}. Di el número para abrir una o 'Lee más'.`;
    }
    else if (viewState.type === 'CART') text = `Carro de compra con ${cart.length} ingredientes.`;
    else if (viewState.type === 'FAVORITES') text = "Tus Favoritos.";
    else if (viewState.type === 'RECIPE') {
       const r = SAMPLE_RECIPES.find(re => re.id === (viewState as any).recipeId);
       text = r ? `Receta ${r.title}. Toca 'A cocinar' para empezar.` : "";
    }

    if (text) setTimeout(() => speakRobust(text), 300);
  }, [viewState, settings.voiceEnabled, showIntro, isGlobalListening]);

  const handleEnterApp = () => {
    setShowIntro(false);
    if (settings.voiceEnabled) {
      setTimeout(() => speakRobust("Bienvenido a Navidad en la Mesa. ¿Qué te apetece cocinar hoy?"), 500);
    }
  };

  const addToCart = (ingredients: Ingredient[]) => {
    const scaled = ingredients.map(i => ({ ...i, amount: (i.amount / 4) * servings }));
    setCart(aggregateIngredients([...cart, ...scaled]));
    speakRobust("Ingredientes añadidos al carro");
  };

  const handleClearCart = () => {
    if (window.confirm("¿Vaciar carro?")) setCart([]);
  };

  // --- NAVEGACIÓN GLOBAL POR VOZ ---
  const handleGlobalVoiceCommand = () => {
    if (isGlobalListening) return;
    setIsGlobalListening(true); // Activa el overlay visual

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { 
        alert("Sin soporte voz"); 
        setIsGlobalListening(false); 
        return; 
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    
    // PROMPT CONTEXTUAL
    let promptText = "¿Qué te apetece cocinar hoy?";
    if (viewState.type === 'CATEGORY') {
        promptText = "¿Qué número abro? O di 'Siguiente página'.";
    }

    speakRobust(promptText, () => {
        // Retraso de seguridad para que no se escuche a sí mismo
        setTimeout(() => {
            try {
                recognition.start();
            } catch(e) {
                console.warn("Global recognition start failed", e);
                setIsGlobalListening(false);
            }
        }, 100);
    });

    recognition.onresult = (e: any) => {
      const rawTranscript = e.results[0][0].transcript;
      const transcript = normalizeText(rawTranscript);
      console.log("Global Cmd:", transcript);
      
      let matched = false;
      let reply = "";

      // 1. Navegación básica
      if (transcript.includes('inicio') || transcript.includes('casa')) {
          setViewState({ type: 'HOME' });
          matched = true;
          reply = "Inicio.";
      }
      else if (transcript.includes('carro') || transcript.includes('compra')) {
          setViewState({ type: 'CART' });
          matched = true;
          reply = "Carro.";
      }
      else if (transcript.includes('favoritos')) {
          setViewState({ type: 'FAVORITES' });
          matched = true;
          reply = "Favoritos.";
      }
      
      // CATEGORÍAS: Cambiamos estado y DEJAMOS QUE EL EFFECT LEA LA LISTA (Reply vacío)
      else if (transcript.includes('aperitivo')) {
          setViewState({ type: 'CATEGORY', category: Category.APERITIVO });
          matched = true;
          reply = ""; // Silencio, el useEffect hablará
      }
      else if (transcript.includes('primero')) {
          setViewState({ type: 'CATEGORY', category: Category.PRIMERO });
          matched = true;
          reply = "";
      }
      else if (transcript.includes('segundo')) {
          setViewState({ type: 'CATEGORY', category: Category.SEGUNDO });
          matched = true;
          reply = "";
      }
      else if (transcript.includes('postre')) {
          setViewState({ type: 'CATEGORY', category: Category.POSTRE });
          matched = true;
          reply = "";
      }
      
      // 2. Leer recetas actuales
      else if (transcript.includes('lee') || transcript.includes('dime') || transcript.includes('lista') || transcript.includes('que hay')) {
        readVisibleRecipes();
        matched = true;
        reply = ""; // readVisibleRecipes ya habla
      } 
      
      // 3. Selección por NÚMERO
      else if (transcript.match(/(uno|dos|tres|cuatro|cinco|primera|segunda|tercera|cuarta|quinta|1|2|3|4|5)/)) {
         const visible = getVisibleRecipes().slice(0, 5);
         let index = -1;
         
         if (transcript.match(/uno|primera|1/)) index = 0;
         else if (transcript.match(/dos|segunda|2/)) index = 1;
         else if (transcript.match(/tres|tercera|3/)) index = 2;
         else if (transcript.match(/cuatro|cuarta|4/)) index = 3;
         else if (transcript.match(/cinco|quinta|5/)) index = 4;

         if (index >= 0 && visible[index]) {
            const r = visible[index];
            reply = `Abriendo ${r.title}`;
            setViewState({ type: 'RECIPE', recipeId: r.id });
            matched = true;
         } else {
            reply = "No encuentro esa receta en la lista visible.";
            matched = true;
         }
      }

      // 4. Búsqueda por nombre
      else {
        // Intento de búsqueda textual en todo el catálogo
        const target = SAMPLE_RECIPES.find(r => transcript.includes(normalizeText(r.title)));
        if (target) {
          reply = `Abriendo ${target.title}`;
          setViewState({ type: 'RECIPE', recipeId: target.id });
          matched = true;
        } else {
            if (!matched) reply = "No te he entendido. Di 'Lee la lista' o el nombre de un plato.";
        }
      }
      
      setIsGlobalListening(false);
      if(reply) speakRobust(reply);
    };
    
    recognition.onerror = () => { 
        setIsGlobalListening(false); 
        speakRobust("No te he oído bien.");
    };
    
    recognition.onend = () => { 
        // Doble seguridad para cerrar el overlay
        setIsGlobalListening(false); 
    };
  };

  const getVisibleRecipes = () => {
    let list = SAMPLE_RECIPES;
    if (viewState.type === 'CATEGORY') {
      list = SAMPLE_RECIPES.filter(r => r.category === viewState.category);
    } else if (searchQuery) {
       list = SAMPLE_RECIPES.filter(r => normalizeText(r.title).includes(normalizeText(searchQuery)));
    }
    return list;
  };

  const readVisibleRecipes = () => {
    const list = getVisibleRecipes().slice(0, 5);
    if (list.length === 0) {
      speakRobust("No veo recetas aquí.");
      return;
    }
    const titles = list.map((r, i) => `Número ${i + 1}: ${r.title}`).join(". ... ");
    speakRobust(`Aquí tienes las primeras cinco: ${titles}. ... Di el número para abrir una.`);
  };

  const fontClass = settings.fontSizeMultiplier === 1 ? 'text-base' : settings.fontSizeMultiplier === 1.25 ? 'text-lg' : 'text-xl';
  const contrastClass = settings.highContrast ? 'bg-gray-900 text-christmas-cream' : 'bg-christmas-cream text-christmas-dark';

  const toggleFavorite = (id: string) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(fid => fid !== id));
      speakRobust("Eliminado de favoritos");
    } else {
      setFavorites([...favorites, id]);
      speakRobust("Añadido a favoritos");
    }
  };

  const renderHome = () => (
    <div className="p-4 pb-24">
      <div className="mb-6 relative">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${settings.highContrast ? 'text-christmas-accent' : 'text-gray-400'}`} />
        <input 
          type="text" 
          placeholder="Buscar receta..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 shadow-inner text-lg ${
            settings.highContrast 
              ? 'bg-black border-christmas-accent text-white placeholder-gray-500' 
              : 'bg-white border-christmas-green/20 focus:border-christmas-red focus:ring-christmas-red'
          }`}
        />
      </div>

      {!searchQuery && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {Object.values(Category).map(cat => (
            <button
              key={cat}
              onClick={() => {
                setViewState({ type: 'CATEGORY', category: cat });
                speakRobust(`Categoría ${cat}`);
              }}
              className={`p-4 rounded-xl text-center font-bold font-serif text-lg shadow-md transition transform hover:scale-105 ${
                settings.highContrast 
                  ? 'bg-gray-800 border-2 border-christmas-accent text-christmas-accent' 
                  : 'bg-white text-christmas-green border border-christmas-gold/30 hover:bg-christmas-cream'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <h2 className={`font-serif font-bold text-2xl mb-4 ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
        {searchQuery ? 'Resultados' : 'Sugerencias para ti'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {getVisibleRecipes().slice(0, searchQuery ? undefined : 6).map(recipe => (
          <RecipeCard 
            key={recipe.id} 
            recipe={recipe} 
            isHighContrast={settings.highContrast}
            fontSizeClass={fontClass}
            onClick={() => setViewState({ type: 'RECIPE', recipeId: recipe.id })} 
          />
        ))}
        {getVisibleRecipes().length === 0 && (
          <p className="text-center opacity-70 col-span-2">No se encontraron recetas.</p>
        )}
      </div>
    </div>
  );

  const renderCategory = (category: Category) => (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setViewState({ type: 'HOME' })}
          className={`p-2 rounded-full ${settings.highContrast ? 'bg-christmas-accent text-black' : 'bg-white text-christmas-red shadow'}`}
        >
          <ArrowLeft />
        </button>
        <h1 className={`font-serif font-bold text-3xl ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
          {category}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SAMPLE_RECIPES.filter(r => r.category === category).map(recipe => (
          <RecipeCard 
            key={recipe.id} 
            recipe={recipe} 
            isHighContrast={settings.highContrast}
            fontSizeClass={fontClass}
            onClick={() => setViewState({ type: 'RECIPE', recipeId: recipe.id })} 
          />
        ))}
      </div>
    </div>
  );

  const renderRecipe = (recipeId: string) => {
    const recipe = SAMPLE_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return <div>Receta no encontrada</div>;

    const isFav = favorites.includes(recipe.id);

    return (
      <div className="pb-32">
        <div className="relative h-72 md:h-96">
          <FestiveImage 
            src={recipe.imageUrl} 
            alt={recipe.title} 
            className="w-full h-full" 
            isHighContrast={settings.highContrast}
          >
            <div className="absolute top-4 left-4">
              <button 
                onClick={() => setViewState({ type: 'HOME' })}
                className={`p-3 rounded-full shadow-lg ${settings.highContrast ? 'bg-black text-christmas-accent border border-christmas-accent' : 'bg-white text-christmas-red'}`}
              >
                <ArrowLeft />
              </button>
            </div>
          </FestiveImage>
          
          <div className={`absolute -bottom-6 right-6 p-4 rounded-full shadow-xl cursor-pointer ${
            isFav 
              ? (settings.highContrast ? 'bg-christmas-accent text-red-900' : 'bg-christmas-red text-white') 
              : (settings.highContrast ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-400')
          }`} onClick={() => toggleFavorite(recipe.id)}>
             <Heart fill={isFav ? "currentColor" : "none"} size={32} />
          </div>
        </div>

        <div className="p-6 pt-10">
          <h1 className={`font-serif font-bold text-4xl mb-4 leading-tight ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
            {recipe.title}
          </h1>

          <div className="flex gap-4 text-sm font-bold opacity-80 mb-6">
             <span className="flex items-center gap-1"><Clock size={16} /> {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min</span>
             <span>•</span>
             <span>{recipe.difficulty}</span>
          </div>

          <div className={`p-6 rounded-2xl mb-8 ${settings.highContrast ? 'bg-gray-900 border border-gray-700' : 'bg-white shadow-sm border border-christmas-gold/20'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl uppercase tracking-wider">Ingredientes ({servings} p.)</h3>
              <div className="flex items-center gap-3">
                 <button onClick={() => setServings(Math.max(1, servings - 1))} className="p-1 rounded bg-gray-200 text-black"><Minus size={16} /></button>
                 <span className="font-mono font-bold text-lg w-6 text-center">{servings}</span>
                 <button onClick={() => setServings(servings + 1)} className="p-1 rounded bg-gray-200 text-black"><Plus size={16} /></button>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              {recipe.ingredients.map((ing, i) => {
                const amount = (ing.amount / recipe.servingsBase) * servings;
                return (
                  <li key={i} className="flex justify-between items-baseline border-b border-gray-100 pb-2 last:border-0">
                    <span className={fontClass}>{ing.name}</span>
                    <span className="font-mono font-bold opacity-70 whitespace-nowrap">
                      {amount % 1 === 0 ? amount : amount.toFixed(1)} {ing.unit}
                    </span>
                  </li>
                );
              })}
            </ul>
            <button 
              onClick={() => addToCart(recipe.ingredients)}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
                settings.highContrast 
                  ? 'bg-christmas-accent text-christmas-dark' 
                  : 'bg-christmas-green text-white hover:bg-green-800'
              }`}
            >
              <ShoppingCart size={20} /> Añadir a la compra
            </button>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-xl uppercase tracking-wider mb-4">Pasos</h3>
            <div className="space-y-4">
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-christmas-red text-white'
                  }`}>
                    {i + 1}
                  </div>
                  <p className={`${fontClass} leading-relaxed`}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`fixed bottom-0 left-0 right-0 p-4 border-t shadow-lg z-40 flex gap-4 ${settings.highContrast ? 'bg-christmas-dark border-christmas-accent' : 'bg-white border-christmas-gold/20'}`}>
          <button 
             onClick={() => setViewState({ type: 'COOKING', recipeId: recipe.id })}
             className={`flex-1 py-4 rounded-xl font-bold text-xl shadow-lg flex items-center justify-center gap-3 ${
               settings.highContrast 
                 ? 'bg-christmas-accent text-christmas-dark hover:bg-white' 
                 : 'bg-christmas-red text-white hover:bg-[#A01616]'
             }`}
          >
             <ChefHat /> ¡A COCINAR!
          </button>
        </div>
      </div>
    );
  };

  const renderCart = () => (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className={`font-serif font-bold text-3xl ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
          Lista de Compra
        </h2>
        {cart.length > 0 && (
          <button onClick={handleClearCart} className="text-sm font-bold text-red-500 flex items-center gap-1">
            <Trash2 size={16} /> Vaciar
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-12 opacity-50">
          <ShoppingCart size={64} className="mx-auto mb-4" />
          <p className="text-xl">Tu carro está vacío</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {cart.map((ing, i) => (
            <li key={i} className={`p-4 rounded-xl flex justify-between items-center ${
              settings.highContrast ? 'bg-gray-900 border border-gray-700' : 'bg-white shadow-sm border border-gray-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer ${settings.highContrast ? 'border-christmas-accent' : 'border-christmas-green'}`}>
                  {/* Checkbox visual placeholder */}
                </div>
                <span className={`font-bold capitalize ${fontClass}`}>{ing.name}</span>
              </div>
              <span className="font-mono font-bold opacity-70 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(1)} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderFavorites = () => {
    const favRecipes = SAMPLE_RECIPES.filter(r => favorites.includes(r.id));

    return (
      <div className="p-4 pb-24">
        <h2 className={`font-serif font-bold text-3xl mb-6 ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
          Mis Favoritos
        </h2>
        
        {favRecipes.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            <Heart size={64} className="mx-auto mb-4" />
            <p className="text-xl">No tienes favoritos aún</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {favRecipes.map(recipe => (
              <RecipeCard 
                key={recipe.id} 
                recipe={recipe} 
                isHighContrast={settings.highContrast}
                fontSizeClass={fontClass}
                onClick={() => setViewState({ type: 'RECIPE', recipeId: recipe.id })} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="p-4 pb-24">
      <h2 className={`font-serif font-bold text-3xl mb-8 ${settings.highContrast ? 'text-christmas-accent' : 'text-christmas-red'}`}>
        Configuración
      </h2>

      <div className={`p-6 rounded-2xl space-y-8 ${settings.highContrast ? 'bg-gray-900 border border-gray-700' : 'bg-white shadow-md'}`}>
        
        {/* Contraste */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg mb-1">Alto Contraste</h3>
            <p className="text-sm opacity-70">Mejora la visibilidad con fondo oscuro</p>
          </div>
          <button 
            onClick={() => setSettings(s => ({ ...s, highContrast: !s.highContrast }))}
            className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.highContrast ? 'bg-christmas-accent' : 'bg-gray-300'}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${settings.highContrast ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* Voz */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg mb-1">Narración por Voz</h3>
            <p className="text-sm opacity-70">Lee en voz alta las pantallas</p>
          </div>
          <button 
            onClick={() => setSettings(s => ({ ...s, voiceEnabled: !s.voiceEnabled }))}
            className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.voiceEnabled ? 'bg-christmas-green' : 'bg-gray-300'}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${settings.voiceEnabled ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* Tamaño Texto */}
        <div>
          <h3 className="font-bold text-lg mb-4">Tamaño de Texto</h3>
          <div className="flex gap-2">
            {[1, 1.25, 1.5].map((size) => (
              <button
                key={size}
                onClick={() => setSettings(s => ({ ...s, fontSizeMultiplier: size }))}
                className={`flex-1 py-3 rounded-xl border-2 font-bold transition ${
                  settings.fontSizeMultiplier === size
                    ? (settings.highContrast ? 'bg-christmas-accent text-black border-christmas-accent' : 'bg-christmas-red text-white border-christmas-red')
                    : 'border-gray-300 opacity-70'
                }`}
              >
                {size === 1 ? 'A' : size === 1.25 ? 'A+' : 'A++'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (showIntro) {
    return (
      <div 
        onClick={handleEnterApp}
        className="fixed inset-0 z-[200] bg-christmas-red flex flex-col items-center justify-center text-christmas-cream cursor-pointer p-6 text-center"
        role="button"
        aria-label="Bienvenido a Navidad en la Mesa. Toca la pantalla para entrar y activar el sonido."
      >
        <ChefHat size={80} className="mb-6 animate-bounce text-christmas-accent" />
        <h1 className="text-5xl font-serif font-bold mb-4 text-christmas-accent drop-shadow-lg">Navidad en la Mesa</h1>
        <p className="text-2xl mb-12 max-w-md">Tu asistente de cocina accesible.</p>
        
        <div className="bg-christmas-green px-8 py-4 rounded-full text-2xl font-bold shadow-xl animate-pulse flex items-center gap-3 border-2 border-christmas-gold">
          <Play fill="currentColor" /> TOCA PARA ENTRAR
        </div>
        <p className="mt-8 opacity-70 text-sm">Al entrar activarás el asistente de voz</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${contrastClass}`}>
      {viewState.type !== 'COOKING' && <Header settings={settings} setViewState={setViewState} cartCount={cart.length} />}
      
      <main className="max-w-4xl mx-auto">
        {viewState.type === 'HOME' && renderHome()}
        {viewState.type === 'CATEGORY' && renderCategory(viewState.category)}
        {viewState.type === 'RECIPE' && renderRecipe(viewState.recipeId)}
        {viewState.type === 'CART' && renderCart()}
        {viewState.type === 'FAVORITES' && renderFavorites()}
        {viewState.type === 'SETTINGS' && renderSettings()}
        {viewState.type === 'COOKING' && (() => {
           const r = SAMPLE_RECIPES.find(re => re.id === viewState.recipeId);
           if (!r) return null;
           return <CookingMode recipe={r} settings={settings} onClose={() => setViewState({ type: 'RECIPE', recipeId: r.id })} />;
        })()}
      </main>
      
      {/* BOTÓN / BARRA INFERIOR DE ASISTENTE */}
      {viewState.type !== 'COOKING' && settings.voiceEnabled && (
        <button
          onClick={handleGlobalVoiceCommand}
          className={`fixed bottom-0 left-0 right-0 p-6 font-bold text-xl uppercase tracking-widest flex items-center justify-center gap-4 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] z-50 transition-colors ${
             settings.highContrast 
               ? 'bg-christmas-accent text-christmas-dark border-t-2 border-christmas-cream hover:bg-white' 
               : 'bg-christmas-red text-white border-t-4 border-christmas-gold hover:bg-[#A01616]'
          }`}
          aria-label="Asistente de Voz Global. Botón en la parte inferior de la pantalla. Pulsa para pedir una receta o navegar."
        >
          <Mic size={32} />
          <span>Toca para hablar</span>
        </button>
      )}

      {/* OVERLAY DE ESCUCHA GLOBAL (Feedback Visual) */}
      {isGlobalListening && (
          <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 ${
              settings.highContrast ? 'bg-christmas-accent text-christmas-dark' : 'bg-christmas-red text-white'
          }`}>
              <Mic size={80} className="mb-6 animate-pulse" />
              <h2 className="text-4xl font-bold uppercase tracking-widest mb-4">Te escucho...</h2>
              <p className="text-xl opacity-90 max-w-md">Di el nombre de un plato, "Inicio", o "Lee la lista".</p>
              <button 
                onClick={() => setIsGlobalListening(false)}
                className="mt-12 px-8 py-3 rounded-full bg-black/20 font-bold hover:bg-black/30"
              >
                Cancelar
              </button>
          </div>
      )}
    </div>
  );
}
