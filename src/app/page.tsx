import { StagePlop } from "@/components/stage-plop";

export default function Home() {
  return (
    <>
      <StagePlop />
      {/* Buy Me a Coffee button (#23), as their snippet, with defer so it never holds up the page. */}
      <script
        data-name="BMC-Widget"
        data-cfasync="false"
        src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
        data-id="rainbows4dinos"
        data-description="Support me on Buy me a coffee!"
        data-message="Thanks for trying Stage Plop! This app will always be free, but tips are appreciated! "
        data-color="#BD5FFF"
        data-position="Right"
        data-x_margin="18"
        data-y_margin="18"
        defer
      />
    </>
  );
}
