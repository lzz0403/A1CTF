import PageHeader from "components/A1Headers";
import A1Footer from "components/A1Footer";
import { useEffect } from "react";
import { MainPageAnimation } from "components/MainPageAnimation";
import SafeComponent from "components/SafeComponent";
import { useGlobalVariableContext } from "contexts/GlobalVariableContext";

export default function A1CTFMainPage() {

  const { clientConfig } = useGlobalVariableContext();

  useEffect(() => {
    if (clientConfig.gameActivityMode) {
      
      window.location.href = `/games/${clientConfig.gameActivityMode}/info`;
    }
  }, [clientConfig]);

  return (
    <>
      <div className="p-0 h-screen flex flex-col">
        <PageHeader />
        <main className="flex flex-1 overflow-hidden">
          <SafeComponent animation={false}>
            <>
              <MainPageAnimation />
            </>
          </SafeComponent>
        </main>
        <A1Footer />
      </div>
    </>
  );
}
