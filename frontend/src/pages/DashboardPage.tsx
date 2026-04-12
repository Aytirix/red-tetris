import { useEffect, useState } from "react";
import DashboardParallaxScene, {
	type SceneTheme,
} from "../components/DashboardParallaxScene";

function readStoredTheme(): SceneTheme {
	const stored = localStorage.getItem("dashboard:theme");
	if (stored === "pirates" || stored === "marines") return stored;
	const faction = localStorage.getItem("faction");
	return faction === "marines" ? "marines" : "pirates";
}

export default function DashboardPage() {
	const [theme, setTheme] = useState<SceneTheme>(readStoredTheme);

	useEffect(() => {
		localStorage.setItem("dashboard:theme", theme);
	}, [theme]);

	function toggleTheme() {
		setTheme((t) => (t === "pirates" ? "marines" : "pirates"));
	}

	return (
		<DashboardParallaxScene theme={theme}>
			{/* Dashboard content goes here — rendered above the parallax layers.
			    Remove or replace this placeholder once the real dashboard UI exists. */}
			<div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
				<h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2.4rem)", margin: 0 }}>
					{theme === "pirates" ? "☠ Équipage" : "⚓ Marines"}
				</h1>
				<button
					type="button"
					className="button button-outline"
					onClick={toggleTheme}
					style={{ minWidth: "9rem" }}
				>
					{theme === "pirates" ? "Passer Marines" : "Passer Pirates"}
				</button>
			</div>
		</DashboardParallaxScene>
	);
}
