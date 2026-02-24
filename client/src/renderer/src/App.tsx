import { HashRouter, Routes, Route } from 'react-router';

function Home(): JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <h1 className="text-2xl font-bold text-text-primary">Discord Clone</h1>
    </div>
  );
}

function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
