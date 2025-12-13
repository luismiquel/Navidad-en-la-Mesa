export default function App() {
  return (
    <main className="min-h-screen bg-christmas-cream text-christmas-dark flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
        Navidad en la Mesa
      </h1>

      <p className="text-lg max-w-xl mb-6">
        Tu asistente culinario festivo y accesible.
      </p>

      <a
        href="#cocina"
        className="inline-block bg-christmas-red text-white px-6 py-3 rounded-lg font-semibold focus:outline-none focus-visible:ring"
      >
        Entrar a la cocina
      </a>
    </main>
  );
}
