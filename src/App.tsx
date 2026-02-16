import SideBar from "./components/SideBar";
import Home from "./components/pages/Home";
import { useStateContext } from "./components/context/StateProvider";
import App2 from "./components/pages/App2";
import Summarizer from "./components/pages/Summarizer";
import WebScraper from "./components/pages/WebScraper";
import EmailAssistant from "./components/pages/Emailassistant";
import RecipeGenerator from "./components/pages/Recipegenerator";

function App() {
  const { currentApp } = useStateContext();

  return (
    <div className="flex flex-row">
      <SideBar />
      <div className="bg-gray-100 w-full">
        {currentApp === "home" && <Home />}
        {currentApp === "RAG Chatbot" && <App2 />}
        {currentApp === "Summarizer" && <Summarizer />}
        {currentApp === "WebScraper" && <WebScraper />}
        {currentApp === "Emailassistant" && <EmailAssistant />}
        {currentApp === "Recipegenerator" && <RecipeGenerator />}
      </div>
    </div>
  );
}

export default App;
