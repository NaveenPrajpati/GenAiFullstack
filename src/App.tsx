import SideBar from "./components/SideBar";
import Home from "./components/pages/Home";
import { useStateContext } from "./components/context/StateProvider";
import App2 from "./components/pages/App2";

function App() {
  const { currentApp } = useStateContext();

  return (
    <div className="flex flex-row">
      <SideBar />
      <div className="bg-gray-100 w-full">
        {currentApp === "home" && <Home />}
        {currentApp === "app2" && <App2 />}
      </div>
    </div>
  );
}

export default App;
