import { useStateContext } from "./context/StateProvider";

export default function SideBar() {
  const apps = ["home", "RAG Chatbot"];
  const { setCurrentApp } = useStateContext();
  return (
    <div className=" w-64 h-screen bg-yellow-100 p-2">
      SideBar
      <div className=" flex flex-col gap-2 mt-4  ">
        {apps.map((app, index) => (
          <div
            onClick={() => {
              const key = app === "RAG Chatbot" ? "app2" : "home";
              setCurrentApp(key as "home" | "app2");
            }}
            key={index}
            className=" mb-2 bg-white p-2 cursor-pointer"
          >
            {app}
          </div>
        ))}
      </div>
    </div>
  );
}
