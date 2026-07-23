import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import GameOverView from "./GameOverView";
import type { GameOverPayload } from "../../types/game";

afterEach(cleanup);

type PlayerProfile = {
	username: string;
	avatar: string;
	faction: "pirate" | "marine" | null;
};

const NO_PLAYERS: PlayerProfile[] = [];

describe("GameOverView — cas où rien ne s'affiche", () => {
	it("ne rend rien sans payload", () => {
		const { container } = render(
			<GameOverView payload={null} playerName="luffy" players={NO_PLAYERS} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("ne rend rien si le joueur n'a pas participe", () => {
		const payload: GameOverPayload = {
			winner: "zoro",
			scores: [{ username: "zoro", score: 100 }],
		};
		const { container } = render(
			<GameOverView payload={payload} playerName="luffy" players={NO_PLAYERS} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("ne rend rien avec une liste de scores vide", () => {
		const { container } = render(
			<GameOverView
				payload={{ winner: null, scores: [] }}
				playerName="luffy"
				players={NO_PLAYERS}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});
});

describe("GameOverView — partie solo", () => {
	it("affiche le resume solo avec points et level", () => {
		const payload: GameOverPayload = {
			winner: "luffy",
			scores: [{ username: "luffy", score: 4200, level: 6 }],
		};
		const { container } = render(
			<GameOverView payload={payload} playerName="luffy" players={NO_PLAYERS} />,
		);

		expect(screen.getByText("Solo game")).toBeInTheDocument();
		expect(screen.getByText("Résumé de partie")).toBeInTheDocument();
		expect(
			container.querySelector(".tetris-over__solo-stat--score strong")?.textContent,
		).toBe((4200).toLocaleString());
		expect(screen.getByText("Level final")).toBeInTheDocument();
		expect(screen.getByText("6")).toBeInTheDocument();
		expect(container.querySelector(".tetris-over__winner")).toBeNull();
		expect(container.querySelector(".tetris-over__podium")).toBeNull();
		expect(container.querySelector(".tetris-over__title--win")).not.toBeNull();
	});

	it("affiche un level par defaut de 1 quand il est absent", () => {
		const payload: GameOverPayload = { winner: null, scores: [{ username: "luffy", score: 10 }] };
		render(<GameOverView payload={payload} playerName="luffy" players={NO_PLAYERS} />);

		expect(screen.getByText("Résumé de partie")).toBeInTheDocument();
		expect(screen.getByText("1")).toBeInTheDocument();
	});
});

describe("GameOverView — partie multi", () => {
	const scores = [
		{ username: "luffy", score: 5000, level: 8 },
		{ username: "zoro", score: 4000 },
		{ username: "nami", score: 3000 },
		{ username: "usopp", score: 2000 },
		{ username: "sanji", score: 1000 },
	];

	it("annonce la victoire du joueur", () => {
		render(
			<GameOverView
				payload={{ winner: "luffy", scores }}
				playerName="luffy"
				players={NO_PLAYERS}
			/>,
		);

		expect(screen.getByText("Classement final")).toBeInTheDocument();
		expect(screen.getByText("Victoire")).toBeInTheDocument();
		expect(screen.getByText("Gagnant")).toBeInTheDocument();
	});

	it("annonce la defaite quand un autre joueur gagne", () => {
		const { container } = render(
			<GameOverView payload={{ winner: "zoro", scores }} playerName="luffy" players={NO_PLAYERS} />,
		);

		expect(screen.getByText("Game Over")).toBeInTheDocument();
		expect(container.querySelector(".tetris-over__title--win")).toBeNull();
	});

	it("annonce l'egalite quand il n'y a pas de gagnant", () => {
		const { container } = render(
			<GameOverView payload={{ winner: null, scores }} playerName="luffy" players={NO_PLAYERS} />,
		);

		expect(screen.getByText("Égalité")).toBeInTheDocument();
		expect(container.querySelector(".tetris-over__winner")).toBeNull();
	});

	it("limite le podium aux trois premiers et liste le reste a partir du 4e", () => {
		const { container } = render(
			<GameOverView
				payload={{ winner: "luffy", scores }}
				playerName="luffy"
				players={NO_PLAYERS}
			/>,
		);

		const slots = Array.from(container.querySelectorAll(".tetris-over__podium-slot"));
		expect(slots).toHaveLength(3);
		expect(slots[0].className).toContain("tetris-over__podium-slot--first");
		expect(slots[1].className).toContain("tetris-over__podium-slot--second");
		expect(slots[2].className).toContain("tetris-over__podium-slot--third");

		const list = container.querySelector("ol.tetris-over__scores") as HTMLOListElement;
		expect(list.getAttribute("start")).toBe("4");
		expect(list.querySelectorAll("li")).toHaveLength(2);
		expect(screen.getByText("#4")).toBeInTheDocument();
		expect(screen.getByText("#5")).toBeInTheDocument();
	});

	it("met en evidence le joueur courant sur le podium et dans la liste", () => {
		const { container } = render(
			<GameOverView payload={{ winner: "luffy", scores }} playerName="luffy" players={NO_PLAYERS} />,
		);
		expect(container.querySelectorAll(".tetris-over__podium-slot--me")).toHaveLength(1);
		expect(container.querySelectorAll(".tetris-over__score--me")).toHaveLength(0);

		cleanup();

		const second = render(
			<GameOverView payload={{ winner: "luffy", scores }} playerName="sanji" players={NO_PLAYERS} />,
		);
		expect(second.container.querySelectorAll(".tetris-over__podium-slot--me")).toHaveLength(0);
		expect(second.container.querySelectorAll(".tetris-over__score--me")).toHaveLength(1);
	});

	it("n'affiche pas de liste secondaire avec seulement trois joueurs", () => {
		const { container } = render(
			<GameOverView
				payload={{ winner: "luffy", scores: scores.slice(0, 3) }}
				playerName="luffy"
				players={NO_PLAYERS}
			/>,
		);
		expect(container.querySelector("ol.tetris-over__scores")).toBeNull();
	});
});

describe("GameOverView — avatars", () => {
	const scores = [
		{ username: "luffy", score: 5000 },
		{ username: "zoro", score: 4000 },
		{ username: "nami", score: 3000 },
		{ username: "usopp", score: 2000 },
	];

	const players: PlayerProfile[] = [
		{ username: "luffy", avatar: "luffy1", faction: "pirate" },
		{ username: "zoro", avatar: "", faction: "pirate" },
		{ username: "nami", avatar: "nami1", faction: null },
		{ username: "usopp", avatar: "usopp1", faction: "marine" },
	];

	it("affiche l'image du joueur quand la faction et l'avatar sont connus", () => {
		render(
			<GameOverView payload={{ winner: "luffy", scores }} playerName="luffy" players={players} />,
		);

		expect(screen.getByAltText("luffy")).toHaveAttribute("src", "/img/avatar/pirate/luffy1.png");
		expect(screen.getByAltText("usopp")).toHaveAttribute("src", "/img/avatar/marine/usopp1.png");
	});

	it("retombe sur les initiales quand l'avatar ou la faction manque", () => {
		render(
			<GameOverView payload={{ winner: "luffy", scores }} playerName="luffy" players={players} />,
		);

		expect(screen.queryByAltText("zoro")).toBeNull();
		expect(screen.queryByAltText("nami")).toBeNull();
		expect(screen.getByText("ZO")).toBeInTheDocument();
		expect(screen.getByText("NA")).toBeInTheDocument();
	});

	it("retombe sur les initiales quand le profil est inconnu", () => {
		render(
			<GameOverView payload={{ winner: "luffy", scores }} playerName="luffy" players={NO_PLAYERS} />,
		);

		expect(screen.queryByAltText("luffy")).toBeNull();
		expect(screen.getByText("LU")).toBeInTheDocument();
		expect(screen.getByText("US")).toBeInTheDocument();
	});
});
