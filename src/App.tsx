export default function App() {
  return (
    <main className="min-h-screen bg-[#FFFCF5] text-[#1F2937] flex items-center justify-center p-6">
      <section className="max-w-xl text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Navidad en la Mesa
        </h1>

        <p className="text-lg md:text-xl mb-8">
          Tu asistente culinario festivo y accesible.
        </p>

        <a
          href="#cocina"
          className="inline-block px-6 py-3 rounded-lg font-semibold bg-[#15803D] text-white"
        >
          Entrar a la cocina
        </a>

        {/* Placeholder sección destino */}
        <div id="cocina" className="mt-16 text-left">
          <h2 className="text-xl font-semibold mb-2">Cocina</h2>
          <p className="text-sm opacity-80">
            (Aquí irá el contenido: menús, recetas, tiempos…)
          </p>
        </div>
      </section>
    </main>
  );
}
