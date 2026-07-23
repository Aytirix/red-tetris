import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DashboardParallaxScene from "./index";
import { SCENE_THEMES } from "./themes";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function srcList(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src") ?? "");
}

describe("DashboardParallaxScene", () => {
	it("rend les calques pirates", () => {
		const { container } = render(<DashboardParallaxScene theme="pirate" />);

		expect(srcList(container)).toEqual([
			"/img/dashboard/pirate/pirate_sky.jpg",
			"/img/dashboard/pirate/pirate_ship_masts_sails.png",
			"/img/dashboard/pirate/pirate_ship_hull.png",
			"/img/dashboard/pirate/pirate_foreground_left.png",
			"/img/dashboard/pirate/pirate_foreground_right.png",
		]);
	});

	it("rend les calques marines", () => {
		const { container } = render(<DashboardParallaxScene theme="marine" />);

		expect(srcList(container)).toEqual([
			"/img/dashboard/marine/marine_sky.jpg",
			"/img/dashboard/marine/marine_headquarters_ship.png",
			"/img/dashboard/marine/marine_flags_architecture.png",
			"/img/dashboard/marine/marine_foreground_left.png",
			"/img/dashboard/marine/marine_foreground_right.png",
		]);
	});

	it("n'insere pas de conteneur de contenu sans enfants", () => {
		const { container } = render(<DashboardParallaxScene theme="pirate" />);

		expect(container.querySelectorAll("[class*='content']")).toHaveLength(0);
	});

	it("rend les enfants au-dessus de la scene", () => {
		render(
			<DashboardParallaxScene theme="pirate">
				<p>panneau</p>
			</DashboardParallaxScene>,
		);

		expect(screen.getByText("panneau")).toBeInTheDocument();
	});

	it("masque un calque de premier plan dont l'image est introuvable", () => {
		const { container } = render(<DashboardParallaxScene theme="pirate" />);
		const fg = container.querySelector('img[src="/img/dashboard/pirate/pirate_foreground_left.png"]') as HTMLImageElement;

		fireEvent.error(fg);

		expect((fg.parentElement as HTMLElement).style.display).toBe("none");
	});

	it("suit la souris et revient au repos quand le curseur sort", () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { container } = render(<DashboardParallaxScene theme="pirate" />);
		const scene = container.firstElementChild as HTMLElement;
		scene.getBoundingClientRect = () => ({
			left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0,
			toJSON: () => ({}),
		}) as DOMRect;

		act(() => {
			window.dispatchEvent(
				Object.assign(new Event("pointermove"), { pointerType: "mouse", clientX: 200, clientY: 200 }),
			);
			vi.advanceTimersByTime(1000);
		});
		const moved = Number(scene.style.getPropertyValue("--px"));
		expect(moved).toBeGreaterThan(0.5);

		act(() => {
			window.dispatchEvent(new Event("pointerleave"));
			vi.advanceTimersByTime(2000);
		});
		expect(Number(scene.style.getPropertyValue("--px"))).toBeLessThan(moved);

		vi.useRealTimers();
	});

	it("ignore les pointeurs tactiles", () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { container } = render(<DashboardParallaxScene theme="pirate" />);
		const scene = container.firstElementChild as HTMLElement;

		act(() => {
			window.dispatchEvent(
				Object.assign(new Event("pointermove"), { pointerType: "touch", clientX: 200, clientY: 200 }),
			);
			vi.advanceTimersByTime(500);
		});

		expect(Number(scene.style.getPropertyValue("--px"))).toBe(0);
		vi.useRealTimers();
	});
});

describe("SCENE_THEMES", () => {
	it("declare des calques ordonnes et coherents pour chaque theme", () => {
		for (const [theme, layers] of Object.entries(SCENE_THEMES)) {
			expect(layers.length).toBeGreaterThan(0);
			const keys = layers.map((l) => l.key);
			expect(new Set(keys).size).toBe(keys.length);
			for (const layer of layers) {
				expect(layer.src).toContain(`/img/dashboard/${theme}/`);
				expect(layer.depth).toBeGreaterThanOrEqual(0);
				expect(layer.depth).toBeLessThanOrEqual(1);
				expect(layer.zIndex).toBeGreaterThan(0);
			}
		}
	});
});
