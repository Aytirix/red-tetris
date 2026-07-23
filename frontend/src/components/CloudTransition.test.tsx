import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import CloudTransition from "./CloudTransition";

afterEach(cleanup);

describe("CloudTransition", () => {
	it("ne rend rien en phase idle", () => {
		const { container } = render(
			<CloudTransition phase="idle" onCoverDone={vi.fn()} onRevealDone={vi.fn()} />,
		);
		expect(container.querySelector(".cloud-transition")).toBeNull();
	});

	it("rend les deux bancs et le voile en phase cover", () => {
		const { container } = render(
			<CloudTransition phase="cover" onCoverDone={vi.fn()} onRevealDone={vi.fn()} />,
		);
		expect(container.querySelector(".cloud-transition--cover")).not.toBeNull();
		expect(container.querySelectorAll(".cloud-transition__bank")).toHaveLength(2);
		expect(container.querySelector(".cloud-transition__veil")).not.toBeNull();
	});

	it("appelle onCoverDone à la fin de l'animation du voile en phase cover", () => {
		const onCoverDone = vi.fn();
		const onRevealDone = vi.fn();
		const { container } = render(
			<CloudTransition phase="cover" onCoverDone={onCoverDone} onRevealDone={onRevealDone} />,
		);

		fireEvent.animationEnd(container.querySelector(".cloud-transition__veil")!);

		expect(onCoverDone).toHaveBeenCalledTimes(1);
		expect(onRevealDone).not.toHaveBeenCalled();
	});

	it("appelle onRevealDone à la fin de l'animation du voile en phase reveal", () => {
		const onCoverDone = vi.fn();
		const onRevealDone = vi.fn();
		const { container } = render(
			<CloudTransition phase="reveal" onCoverDone={onCoverDone} onRevealDone={onRevealDone} />,
		);

		fireEvent.animationEnd(container.querySelector(".cloud-transition__veil")!);

		expect(onRevealDone).toHaveBeenCalledTimes(1);
		expect(onCoverDone).not.toHaveBeenCalled();
	});
});
