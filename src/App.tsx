import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import Home from './pages/Home';
import Agendar from './pages/Agendar';
import Painel from './pages/Painel';
import Gerenciador from './pages/Gerenciador';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Painel TV sem navbar (ideal para fullscreen em TV) */}
        <Route path="/painel" element={<Painel />} />

        {/* Demais páginas com navbar */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/agendar" element={<Agendar />} />
                  <Route path="/gerenciador" element={<Gerenciador />} />
                </Routes>
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
