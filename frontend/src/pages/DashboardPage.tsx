import { useWsSession } from "../contexts/WsStateContext";
import DashboardParallaxScene from "../components/DashboardParallaxScene";

export default function DashboardPage() {
	const { faction } = useWsSession();

	// Theme follows the player's registered faction automatically.
	// Falls back to "pirates" when faction is null (not yet registered / loading).
	const theme = faction ?? "pirate";

	return (
		<DashboardParallaxScene theme={theme}>
			{/* Dashboard content goes here — rendered above all parallax layers. */}
		</DashboardParallaxScene>
	);
}
